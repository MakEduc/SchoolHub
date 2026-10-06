"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="error-page"><span className="eyebrow">A SMALL PAUSE</span><h1>Let’s give that another try.</h1><p>We couldn’t open this page. Please try again in a moment.</p><button className="button primary" onClick={reset}>Try again</button></div>; }
