import { Text } from "@/components/language";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
export default function NotFound() { return <div className="error-page"><BookOpen size={36} /><span className="eyebrow" style={{ display: "block", marginTop: 20 }}><Text>A LITTLE OFF THE MAP</Text></span><h1><Text>Let’s head back to the commons.</Text></h1><p><Text>This page isn’t here. Your school space is just one click away.</Text></p><Link href="/" className="button primary"><Text>Back to SchoolHub</Text><ArrowRight size={16} /></Link></div>; }
