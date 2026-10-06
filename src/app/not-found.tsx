import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
export default function NotFound() { return <div className="error-page"><BookOpen size={36} /><span className="eyebrow" style={{ display: "block", marginTop: 20 }}>A LITTLE OFF THE MAP</span><h1>Let’s head back to the commons.</h1><p>This page isn’t here. Your school space is just one click away.</p><Link href="/" className="button primary">Back to SchoolHub <ArrowRight size={16} /></Link></div>; }
