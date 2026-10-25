import './about-page.css'

export default function AboutPage({ onHome }) {
  return <main className="about-page">
    <header className="about-topbar"><a className="about-brand" href="/" onClick={(event) => { event.preventDefault(); onHome() }}><img src="/brand/amanzi-logo.png" alt="Amanzi" /></a><button className="about-home-button" onClick={onHome}><span aria-hidden="true">&larr;</span> Back to Amanzi</button></header>
    <section className="about-hero">
      <span className="about-kicker">ABOUT AMANZI</span>
      <h1>Getting water should be simpler.</h1>
      <p>Amanzi is exploring a simpler way for households and local businesses to order delivered water. Compare a clear estimate, choose the amount you need, and prepare a delivery request from one place.</p>
      <div className="about-watermark" aria-hidden="true">amanzi</div>
    </section>
    <section className="about-grid" aria-label="How Amanzi works">
      <article className="about-card"><h2>Choose your amount</h2><p>Plan an order by volume, from household quantities to larger deliveries for local businesses.</p></article>
      <article className="about-card"><h2>Review the estimate</h2><p>See water, delivery and estimated VAT as separate parts of the price before preparing a request.</p></article>
      <article className="about-card"><h2>Know what is confirmed</h2><p>A supplier still needs to confirm availability, the final quote and delivery timing before an order can be completed.</p></article>
    </section>
    <section className="about-trust"><div><span className="about-kicker">A PROTOTYPE IN PROGRESS</span><h2>Clear estimates. Honest availability.</h2></div><p>The prices shown in this prototype use working assumptions for a hackathon demonstration. Supplier listings, live stock, delivery routing, payment and final quotes still need to be connected and validated with local partners.</p></section>
    <footer className="footer about-footer"><span>&copy; 2026 Amanzi</span><span>Making essential water easier to order.</span></footer>
  </main>
}
