import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="gate">
      <section className="pass">
        <h1>Page not found</h1>
        <p className="lead">This page does not exist in the admin site.</p>
        <Link className="btn" href="/">Go to Today</Link>
      </section>
    </main>
  );
}
