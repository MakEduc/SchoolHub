import { cookies } from "next/headers";
import { requireSchool, schoolAccess, SCHOOL_COOKIE, CHALLENGE_COOKIE } from "@/lib/school-access";
import { schoolEmailDomain } from "@/lib/school-verification";
import { NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { signInErrorMessage } from "@/lib/auth-errors";
import { adminSupabase, userSupabase } from "@/lib/supabase/server";
import { balancedAssignments, debateSchema, questionSchema, studySchema, type Participant, type Stance } from "@/lib/domain";
import { ApiError, dbError, failure, hash, isFlagged, json, rateLimit, readBody, staff, token, uuid } from "@/lib/server-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };

async function schoolPost(request: NextRequest, route: string, body: unknown) {
  const db = adminSupabase(), store = await cookies();
  if (route === "school/request-code") {
    const input = z.object({ email: z.email().max(254), language: z.enum(["en", "bs"]).default("en") }).parse(body);
    await rateLimit(request, "school-email", 3, 600, 100);
    const domain = schoolEmailDomain(input.email);
    const school = await db.from("school_domains").select("school_id,school:schools!inner(active)").eq("domain", domain || "").eq("school.active", true).maybeSingle();
    dbError(school.error);
    if (!school.data) throw new ApiError("Use an email from a participating school.");
    const auth = await userSupabase();
    const result = await auth.auth.signInWithOtp({ email: input.email.trim().toLowerCase(), options: { shouldCreateUser: true, emailRedirectTo: new URL("/auth/callback", request.nextUrl.origin).toString() } });
    if (result.error) throw new ApiError(signInErrorMessage(result.error, "student"), result.error.status === 429 ? 429 : 400);
    return json({ success: true });
  }
  if (route === "school/verify-code") {
    const input = z.object({ email: z.email().max(254), code: z.string().regex(/^\d{6,8}$/) }).parse(body);
    await rateLimit(request, "school-verify", 10, 600);
    const school = await db.from("school_domains").select("school_id,school:schools!inner(active)").eq("domain", schoolEmailDomain(input.email) || "").eq("school.active", true).maybeSingle();
    dbError(school.error);
    if (!school.data) throw new ApiError("Use an email from a participating school.");
    const auth = await userSupabase();
    const result = await auth.auth.verifyOtp({ email: input.email.trim().toLowerCase(), token: input.code, type: "email" });
    if (result.error || !result.data.user?.email_confirmed_at) throw new ApiError("That code is invalid or has expired. Please try again.");
    if (!await schoolAccess()) { await auth.auth.signOut(); throw new ApiError("Your school access is unavailable.", 403); }
    return json({ success: true });
  }
  if (route === "school/leave") {
    const session = store.get(SCHOOL_COOKIE)?.value, challenge = store.get(CHALLENGE_COOKIE)?.value;
    if (session) dbError((await db.from("school_sessions").delete().eq("token_hash", hash(session))).error);
    if (challenge) dbError((await db.from("school_challenges").delete().eq("id", challenge)).error);
    store.delete(SCHOOL_COOKIE); store.delete(CHALLENGE_COOKIE);
    const auth = await userSupabase(); await auth.auth.signOut();
    return json({ success: true });
  }
  throw new ApiError("Not found.", 404);
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { path } = await context.params;
    const route = path.join("/");
    if (route === "school/status") return json(await schoolAccess());
    const { schoolId } = await requireSchool();
    const pub = adminSupabase();
    if (route === "config") {
      const results = await Promise.all([
        pub.from("departments").select("id,name").eq("school_id", schoolId).order("name"), pub.from("subjects").select("id,name").eq("school_id", schoolId).order("name"),
        pub.from("locations").select("id,name").eq("school_id", schoolId).order("name"), pub.from("teacher_directory").select("id,display_name").eq("school_id", schoolId).order("display_name"),
      ]);
      results.forEach(r => dbError(r.error));
      return json({ departments: results[0].data, subjects: results[1].data, locations: results[2].data, teachers: results[3].data });
    }
    if (route === "questions") {
      const result = await pub.from("public_questions").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(200);
      dbError(result.error); return json(result.data);
    }
    if (route === "studies") {
      const result = await pub.from("active_study_sessions").select("*").eq("school_id", schoolId).in("programme", ["IB", "National"]).order("starts_at").limit(200);
      dbError(result.error); return json(result.data);
    }
    if (route === "boards") {
      const result = await pub.from("public_boards").select("id,slug,title").eq("school_id", schoolId).order("title");
      dbError(result.error); return json(result.data);
    }
    if (path[0] === "teacher" && path[1] === "boards" && path.length === 3) {
      const { db, profile } = await staff();
      const board = await db.from("public_boards").select("id,title,slug").eq("school_id", schoolId).eq("id", uuid.parse(path[2])).eq("owner_id", profile.id).maybeSingle();
      dbError(board.error); if (!board.data) throw new ApiError("Board unavailable.", 404);
      const questions = await pub.from("published_questions").select("id,body,status,published_at,answer,answered_at").eq("school_id", schoolId).eq("slug", board.data.slug).order("published_at", { ascending: false });
      dbError(questions.error); return json({ ...board.data, questions: questions.data });
    }
    if (path[0] === "board" && path.length === 2) {
      const board = await pub.from("public_boards").select("title,slug").eq("school_id", schoolId).eq("slug", path[1]).maybeSingle();
      dbError(board.error); if (!board.data) throw new ApiError("Board not found.", 404);
      const items = await pub.from("published_questions").select("id,body,status,published_at,answer,answered_at").eq("school_id", schoolId).eq("slug", path[1]).order("published_at", { ascending: false });
      dbError(items.error); return json({ ...board.data, questions: items.data });
    }
    if (route === "teacher") {
      const { db, profile } = await staff();
      const [questions, debates, boards, memberships] = await Promise.all([
        db.from("questions").select("*,department:departments!questions_department_id_fkey(name)").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(200),
        db.from("debate_sessions").select("*").eq("school_id", schoolId).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
        db.from("public_boards").select("id,title,slug").eq("school_id", schoolId).eq("owner_id", profile.id),
        db.from("teacher_departments").select("department_id").eq("school_id", schoolId).eq("teacher_id", profile.id),
      ]);
      [questions, debates, boards, memberships].forEach(r => dbError(r.error));
      return json({ profile, questions: questions.data, debates: debates.data, boards: boards.data, memberships: memberships.data });
    }
    if (path[0] === "debate" && path[1] === "host" && path.length === 3) {
      const { db, profile } = await staff();
      const result = await db.from("debate_sessions").select("*,stances:debate_stances!debate_stances_session_id_fkey(id,label,position),participants:debate_participants!debate_participants_session_id_fkey(id,display_name,stance_id)").eq("school_id", schoolId)
        .eq("id", uuid.parse(path[2])).eq("teacher_id", profile.id).gt("expires_at", new Date().toISOString()).maybeSingle();
      dbError(result.error); if (!result.data) throw new ApiError("Debate not found or expired.", 404);
      return json({ ...result.data, serverTime: new Date().toISOString() });
    }
    if (path[0] === "debate" && path[1] === "join" && path.length === 3) {
      const code = z.string().regex(/^[A-Z0-9]{6}$/).parse(path[2]);
      const admin = adminSupabase();
      const session = await admin.from("debate_sessions").select("id,prompt,status,prep_seconds,timer_deadline,timer_remaining,expires_at,join_code,stances:debate_stances!debate_stances_session_id_fkey(id,label,position)").eq("school_id", schoolId)
        .eq("join_code", code).gt("expires_at", new Date().toISOString()).maybeSingle();
      dbError(session.error); if (!session.data) throw new ApiError("Lobby not found or expired. Check your join code.", 404);
      const participantToken = request.cookies.get(`debate_${code}`)?.value;
      let participant = null;
      if (participantToken) {
        const result = await admin.from("debate_participants").select("id,display_name,stance_id").eq("school_id", schoolId).eq("session_id", session.data.id).eq("token_hash", hash(participantToken)).maybeSingle();
        dbError(result.error); participant = result.data;
      }
      const count = await admin.from("debate_participants").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("session_id", session.data.id);
      dbError(count.error);
      return json({ session: session.data, participant, count: count.count, serverTime: new Date().toISOString() });
    }
    if (route === "admin") {
      const { profile } = await staff();
      if (profile.role !== "admin") throw new ApiError("School administrator access required.", 403);
      const admin = adminSupabase();
      const [teachers, actions, flagged] = await Promise.all([
        admin.from("teacher_profiles").select("id,display_name,role,active,handles_general,memberships:teacher_departments!teacher_departments_teacher_id_fkey(department_id)").eq("school_id", schoolId).order("display_name"),
        admin.from("staff_actions").select("id,action,target_id,created_at,teacher:teacher_profiles!staff_actions_staff_id_fkey(display_name)").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(30),
        admin.from("questions").select("id,body,created_at,status").eq("school_id", schoolId).eq("moderation_status", "flagged").neq("status", "archived").order("created_at", { ascending: false }),
      ]);
      [teachers,actions,flagged].forEach(r => dbError(r.error));
      return json({ teachers: teachers.data, actions: actions.data, flagged: flagged.data });
    }
    throw new ApiError("Not found.", 404);
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { path } = await context.params;
    const route = path.join("/");
    const body = await readBody(request);
    const admin = adminSupabase();
    if (route.startsWith("school/")) return await schoolPost(request, route, body);
    const { schoolId } = await requireSchool();
    if (route === "questions") {
      const data = questionSchema.parse(body);
      await rateLimit(request, "questions", 5, 600);
      if (data.recipientType === "teacher") {
        const teacher = await admin.from("teacher_profiles").select("id").eq("school_id", schoolId).eq("id", data.recipientId!).eq("active", true).maybeSingle();
        dbError(teacher.error); if (!teacher.data) throw new ApiError("Choose an available teacher.");
      }
      const receiptToken = token();
      const result = await admin.from("questions").insert({ school_id: schoolId, visibility: data.visibility, receipt_token_hash: hash(receiptToken), body: data.body, recipient_type: data.recipientType,
        teacher_id: data.recipientType === "teacher" ? data.recipientId : null,
        department_id: data.recipientType === "department" ? data.recipientId : null,
        moderation_status: isFlagged(data.body) ? "flagged" : "approved",
      }).select("id").single(); dbError(result.error); return json({ id: result.data!.id, receiptToken }, 201);
    }
    if (route === "questions/read") {
      const input = z.object({ id: uuid, token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(body);
      const result = await admin.from("questions").select("id,body,visibility,status,answer,created_at,answered_at").eq("school_id", schoolId)
        .eq("id", input.id).eq("receipt_token_hash", hash(input.token)).maybeSingle();
      dbError(result.error); if (!result.data) throw new ApiError("This private receipt is unavailable.", 404);
      return json(result.data);
    }
    if (route === "studies") {
      const data = studySchema.parse(body);
      await rateLimit(request, "studies", 5, 3600);
      if (new Date(data.endsAt).getTime() <= Date.now()) throw new ApiError("Choose a session that has not ended.");
      if (new Date(data.startsAt).getTime() > Date.now() + 30 * 86400_000) throw new ApiError("Post sessions up to 30 days ahead.");
      const location = await admin.from("locations").select("id").eq("school_id", schoolId).eq("name", "Other").maybeSingle();
      dbError(location.error); if (!location.data) throw new ApiError("Meeting places are unavailable. Apply the database migrations.", 503);
      const managementToken = token();
      const result = await admin.from("study_sessions").insert({ school_id: schoolId, programme: data.programme, grade: data.grade,
        subject_id: data.subjectId, focus: data.focus, location_id: location.data!.id, custom_location: data.meetingPlace,
        starts_at: data.startsAt, ends_at: data.endsAt, open_spots: data.openSpots, host_name: data.hostName || null, contact: data.contact || null,
        management_token_hash: hash(managementToken),
      }).select("id").single(); dbError(result.error);
      return json({ id: result.data!.id, managementToken }, 201);
    }
    if (route === "studies/manage") {
      const input = z.object({ id: uuid, token: z.string().regex(/^[a-f0-9]{64}$/), action: z.enum(["read", "cancel", "update"]), data: studySchema.optional() }).parse(body);
      const result = await admin.from("study_sessions").select("id,programme,grade,subject_id,focus,location_id,custom_location,starts_at,ends_at,open_spots,host_name,contact,cancelled_at,location:locations!study_sessions_location_id_fkey(name)").eq("school_id", schoolId)
        .eq("id", input.id).eq("school_id", schoolId).eq("management_token_hash", hash(input.token)).maybeSingle();
      dbError(result.error); if (!result.data) throw new ApiError("This management link is invalid.", 403);
      if (input.action === "read") return json(result.data);
      if (input.action === "cancel") {
        const cancelled = await admin.from("study_sessions").update({ cancelled_at: new Date().toISOString() }).eq("id", input.id).eq("school_id", schoolId).eq("management_token_hash", hash(input.token));
        dbError(cancelled.error); return json({ success: true });
      }
      if (!input.data) throw new ApiError("Session details are required.");
      if (result.data.cancelled_at) throw new ApiError("This session has been cancelled.");
      const data = input.data;
      if (new Date(data.endsAt).getTime() <= Date.now()) throw new ApiError("Choose a session that has not ended.");
      if (new Date(data.startsAt).getTime() > Date.now() + 30 * 86400_000) throw new ApiError("Post sessions up to 30 days ahead.");
      const location = await admin.from("locations").select("id").eq("school_id", schoolId).eq("name", "Other").maybeSingle();
      dbError(location.error);
      if (!location.data) throw new ApiError("Meeting places are unavailable. Apply the database migrations.", 503);
      const updated = await admin.from("study_sessions").update({ programme: data.programme, grade: data.grade, subject_id: data.subjectId,
        focus: data.focus, location_id: location.data!.id, custom_location: data.meetingPlace,
        starts_at: data.startsAt, ends_at: data.endsAt, open_spots: data.openSpots, host_name: data.hostName || null, contact: data.contact || null,
      }).eq("id", input.id).eq("school_id", schoolId).eq("management_token_hash", hash(input.token));
      dbError(updated.error); return json({ success: true });
    }
    if (route === "debate/join") {
      const data = z.object({ code: z.string().regex(/^[A-Z0-9]{6}$/), name: z.string().trim().min(1).max(50) }).parse(body);
      await rateLimit(request, `debate-join:${data.code}`, 10, 600);
      if (isFlagged(data.name)) throw new ApiError("Please use a classroom-appropriate name.");
      const existing = request.cookies.get(`debate_${data.code}`)?.value;
      if (existing) {
        const p = await admin.from("debate_participants").select("id,session:debate_sessions!debate_participants_session_id_fkey!inner(join_code)").eq("school_id", schoolId).eq("token_hash", hash(existing)).eq("session.join_code", data.code).maybeSingle();
        dbError(p.error); if (p.data) return json({ success: true });
      }
      const participantToken = token();
      const result = await admin.rpc("join_debate", { p_code: data.code, p_name: data.name, p_token_hash: hash(participantToken), p_school: schoolId });
      if (result.error?.code === "P0001") throw new ApiError(result.error.message, 409);
      dbError(result.error);
      const response = json({ success: true }, 201);
      response.cookies.set(`debate_${data.code}`, participantToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 86400, path: "/" });
      return response;
    }
    const { db, profile } = await staff();
    if (route === "boards/manage") {
      const input = z.object({ id: uuid, action: z.enum(["update", "unpin"]), title: z.string().trim().min(3).max(80).optional(), questionId: uuid.optional() }).parse(body);
      const owned = await db.from("public_boards").select("id").eq("school_id", schoolId).eq("id", input.id).eq("owner_id", profile.id).maybeSingle();
      dbError(owned.error); if (!owned.data) throw new ApiError("Board unavailable.", 403);
      if (input.action === "update") {
        if (!input.title) throw new ApiError("Enter a board title.");
        const result = await admin.from("public_boards").update({ title: input.title }).eq("id", input.id).eq("owner_id", profile.id).select("id").maybeSingle();
        dbError(result.error); if (!result.data) throw new ApiError("Board unavailable.", 403);
      } else {
        if (!input.questionId) throw new ApiError("Choose a pinned question.");
        dbError((await admin.from("board_questions").delete().eq("board_id", input.id).eq("question_id", input.questionId)).error);
      }
      return json({ success: true });
    }
    if (route === "admin/invite") {
      if (profile.role !== "admin") throw new ApiError("Administrator access required.", 403);
      const data = z.object({ name: z.string().trim().min(1).max(80), email: z.email() }).parse(body);
      const domain = await admin.from("school_domains").select("school_id").eq("domain", schoolEmailDomain(data.email) || "").eq("school_id", schoolId).maybeSingle();
      dbError(domain.error); if (!domain.data) throw new ApiError("Use a teacher email from your school.");
      const invitation = await admin.auth.admin.inviteUserByEmail(data.email, { redirectTo: new URL("/teacher", request.nextUrl.origin).toString() });
      if (invitation.error || !invitation.data.user) throw new ApiError("Invitation could not be sent. Check the email address and your school's email settings.");
      const result = await admin.from("teacher_profiles").insert({ id: invitation.data.user.id, display_name: data.name, school_id: schoolId });
      if (result.error) { await admin.auth.admin.deleteUser(invitation.data.user.id); dbError(result.error); }
      dbError((await admin.from("staff_actions").insert({ staff_id: profile.id, action: "teacher.invited", target_id: invitation.data.user.id })).error);
      return json({ success: true }, 201);
    }
    if (route === "questions/answer") {
      const data = z.object({ id: uuid, answer: z.string().trim().min(1).max(2000) }).parse(body);
      if (isFlagged(data.answer)) throw new ApiError("Please use a classroom-appropriate answer.");
      const result = await admin.rpc("answer_question", { p_staff: profile.id, p_question: data.id, p_answer: data.answer });
      if (result.error?.code === "P0001") throw new ApiError(result.error.message, result.error.message === "Question unavailable" ? 403 : 400);
      dbError(result.error); return json({ success: true });
    }
    if (route === "questions/action") {
      const data = z.object({ id: uuid, action: z.enum(["answer", "archive", "restore", "approve", "pin", "unpin"]), boardId: uuid.optional() }).parse(body);
      const result = await admin.rpc("mutate_question", { p_staff: profile.id, p_question: data.id, p_action: data.action, p_board: data.boardId || null });
      if (result.error?.code === "P0001") throw new ApiError(result.error.message, result.error.message === "Question unavailable" ? 403 : 400);
      dbError(result.error);
      return json({ success: true });
    }
    if (route === "boards") {
      const data = z.object({ title: z.string().trim().min(3).max(80), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,59}$/, "Use 3–60 lowercase letters, numbers, and hyphens.") }).parse(body);
      const result = await admin.from("public_boards").insert({ school_id: schoolId, ...data, owner_id: profile.id }).select("id,title,slug").single();
      dbError(result.error); return json(result.data, 201);
    }
    if (route === "debate/create") {
      const data = debateSchema.parse(body);
      const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
      const result = await admin.rpc("create_debate", { p_teacher: profile.id, p_prompt: data.prompt, p_stances: data.stances, p_seconds: data.prepSeconds, p_code: code });
      dbError(result.error); return json({ id: result.data }, 201);
    }
    if (route === "debate/action") {
      const data = z.object({ id: uuid, action: z.enum(["assign", "start", "pause", "reset", "reopen", "end", "remove"]), participantId: uuid.optional() }).parse(body);
      if (data.action === "assign") {
        for (let attempt = 0; attempt < 3; attempt++) {
          const session = await db.from("debate_sessions").select("id,stances:debate_stances!debate_stances_session_id_fkey(id),participants:debate_participants!debate_participants_session_id_fkey(id)").eq("school_id", schoolId)
            .eq("id", data.id).eq("teacher_id", profile.id).maybeSingle();
          dbError(session.error); if (!session.data) throw new ApiError("Debate unavailable.", 403);
          const participants = session.data.participants as Pick<Participant, "id">[];
          const stances = session.data.stances as Pick<Stance, "id">[];
          if (!participants.length) throw new ApiError("Let students join before assigning stances.");
          const assignments = balancedAssignments(participants, stances.map(s => s.id)).map(a => ({ participantId: a.student.id, stanceId: a.stanceId }));
          const result = await admin.rpc("assign_debate", { p_session: data.id, p_teacher: profile.id, p_assignments: assignments });
          if (result.error?.message.includes("Roster changed") && attempt < 2) continue;
          if (result.error?.code === "P0001") throw new ApiError(result.error.message, 409);
          dbError(result.error); break;
        }
      } else if (data.action === "remove") {
        if (!data.participantId) throw new ApiError("Choose a participant.");
        // The DB function locks against assignment/join, preserving a consistent roster.
        const result = await admin.rpc("remove_debate_participant", { p_session: data.id, p_teacher: profile.id, p_participant: data.participantId });
        if (result.error?.code === "P0001") throw new ApiError(result.error.message, 409);
        dbError(result.error);
      } else {
        const result = await admin.rpc("control_debate", { p_session: data.id, p_teacher: profile.id, p_action: data.action });
        if (result.error?.code === "P0001") throw new ApiError(result.error.message, 409);
        dbError(result.error);
      }
      return json({ success: true });
    }
    if (route === "admin/teacher") {
      if (profile.role !== "admin") throw new ApiError("Administrator access required.", 403);
      const data = z.object({ id: uuid, handlesGeneral: z.boolean(), departmentIds: z.array(uuid).max(20) }).parse(body);
      const result = await admin.rpc("update_teacher_access", { p_actor: profile.id, p_teacher: data.id, p_general: data.handlesGeneral, p_departments: data.departmentIds });
      dbError(result.error); return json({ success: true });
    }
    if (route === "admin/directory") {
      if (profile.role !== "admin") throw new ApiError("Administrator access required.", 403);
      const data = z.object({ type: z.enum(["departments", "subjects", "locations"]), name: z.string().trim().min(2).max(80) }).parse(body);
      dbError((await admin.from(data.type).insert({ school_id: schoolId, name: data.name })).error);
      return json({ success: true }, 201);
    }
    throw new ApiError("Not found.", 404);
  } catch (error) { return failure(error); }
}
