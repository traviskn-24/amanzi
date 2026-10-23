import './about-page.css'

export default function AboutPage({ onHome }) {
  return <main className="about-page">
    <header className="about-topbar"><a className="about-brand" href="/" onClick={(event) => { event.preventDefault(); onHome() }}><img src="/brand/amanzi-logo.png" alt="Amanzi" /></a><button className="about-home-button" onClick={onHome}><span aria-hidden="true">←</span> Back to Amanzi</button></header>
    <section className="about-hero">
      <span className="about-kicker">ABOUT AMANZI</span>
      <h1>When water is uncertain, neighbours shouldn’t be.</h1>
      <p>Amanzi helps neighbours understand what is happening with water around them. Check nearby reports, share what you’re seeing, and compare updates as conditions change. When service is disrupted, clearer local information helps households plan their next steps.</p>
      <div className="about-watermark" aria-hidden="true">amanzi</div>
    </section>
    <section className="about-grid" aria-label="How Amanzi works">
      <article className="about-card"><h2>See the local picture</h2><p>Read reports from your area and check whether neighbours are seeing the same interruption, low pressure, or restoration.</p></article>
      <article className="about-card"><h2>Share what you know</h2><p>Post a short, structured update that helps people nearby understand the situation and prepare for it.</p></article>
      <article className="about-card"><h2>Act with better context</h2><p>Confirm reports, talk with neighbours, or prepare a fault message for a listed municipal contact when you need to report a problem.</p></article>
    </section>
    <section className="about-trust"><div><span className="about-kicker">CLEAR ABOUT WHAT WE KNOW</span><h2>Community information, with its source in view.</h2></div><p>Resident reports are not official municipal notices. Amanzi labels community information clearly and links to official sources when available. Share an area or nearby landmark in a post; never include your exact home address or private account details.</p></section>
    <footer className="footer about-footer"><span>© 2026 Amanzi</span><span>Community-powered water updates for South Africa</span></footer>
  </main>
}
