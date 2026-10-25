import { useMemo, useState } from 'react'
import './water-marketplace-page.css'

const volumeChoices = [20, 200, 500, 1000]

function money(value) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value)
}

function deliveryRate(litres) {
  if (litres >= 1000) return 0.25
  if (litres >= 200) return 0.5
  return 0.75
}

export default function WaterMarketplacePage({ onSignIn, onAbout }) {
  const [litres, setLitres] = useState(200)
  const [area, setArea] = useState('Phoenix, eThekwini')
  const [address, setAddress] = useState('')
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const safeLitres = Math.floor(Math.max(1, Math.min(20000, Number(litres) || 1)))
  const rate = deliveryRate(safeLitres)
  const quote = useMemo(() => {
    const water = safeLitres
    const delivery = safeLitres * rate
    const subtotal = water + delivery
    const vat = subtotal * 0.15
    return { water, delivery, subtotal, vat, total: subtotal + vat }
  }, [safeLitres, rate])

  function submitRequest(event) {
    event.preventDefault()
    if (!address.trim() || !name.trim() || !phone.trim()) return
    setRequestSent(true)
  }

  function closeRequest() {
    setRequestOpen(false)
    setRequestSent(false)
  }

  return <div className="marketplace-shell">
    <header className="marketplace-header">
      <a className="marketplace-brand" href="/" aria-label="Amanzi home">
        <img src="/brand/amanzi-logo.png" alt="Amanzi" />
      </a>
      <nav className="marketplace-nav" aria-label="Main navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#pricing">Pricing</a>
        <button type="button" onClick={onAbout}>About Amanzi</button>
      </nav>
      <button type="button" className="marketplace-signin" onClick={onSignIn}>Sign in</button>
    </header>

    <main>
      <section className="marketplace-hero">
        <div className="marketplace-hero-copy">
          <span className="marketplace-kicker"><span className="marketplace-kicker-dot" /> WATER DELIVERY, MADE SIMPLE</span>
          <h1>Water delivered<br /><em>to your door.</em></h1>
          <p>Order the amount you need, see the delivery estimate upfront, and request a local supplier in a few steps.</p>
          <div className="marketplace-hero-proof"><span aria-hidden="true">✓</span> Clear prices <span aria-hidden="true">✓</span> Flexible volumes <span aria-hidden="true">✓</span> Local delivery</div>
        </div>

        <section className="delivery-quote-card" aria-labelledby="quote-title">
          <div className="delivery-card-top"><div><span className="marketplace-kicker">START AN ORDER</span><h2 id="quote-title">Estimate your delivery</h2></div><span className="delivery-card-drop" aria-hidden="true">≈</span></div>
          <label className="marketplace-field">Delivery area<input required value={area} onChange={(event) => setArea(event.target.value)} placeholder="Suburb or town" /></label>
          <fieldset className="volume-picker"><legend>How much water do you need?</legend><div className="volume-options">{volumeChoices.map((amount) => <button key={amount} type="button" className={safeLitres === amount ? 'active' : ''} onClick={() => setLitres(amount)}>{amount.toLocaleString()} L</button>)}</div></fieldset>
          <label className="marketplace-field volume-custom">Custom amount<input type="number" inputMode="numeric" min="1" max="20000" value={litres} onChange={(event) => setLitres(event.target.value)} onBlur={() => setLitres(safeLitres)} /><span>litres</span></label>
          <div className="quote-lines" aria-label="Estimated price breakdown"><p><span>Water · {safeLitres.toLocaleString()} L</span><strong>{money(quote.water)}</strong></p><p><span>Delivery · {safeLitres < 200 ? 'Under 200 L tier' : safeLitres < 1000 ? '200 to 999 L tier' : '1,000 L and up'} at R{rate.toFixed(2)} per litre</span><strong>{money(quote.delivery)}</strong></p><p><span>Estimated VAT</span><strong>{money(quote.vat)}</strong></p></div>
          <div className="quote-total" id="pricing">
            <div><span>Estimated total</span><strong>{money(quote.total)}</strong></div>
            <small>Includes water, tiered delivery and estimated VAT</small>
          </div>
          <button type="button" className="marketplace-primary" onClick={() => { setRequestOpen(true); setRequestSent(false) }}>Continue with this estimate <span aria-hidden="true">→</span></button>
          <p className="quote-note">Illustrative pilot estimate. A supplier must confirm the final price, availability and delivery timing.</p>
        </section>
      </section>

      <section className="marketplace-strip" aria-label="Amanzi benefits">
        <div><span className="benefit-number">01</span><div><strong>Choose your volume</strong><small>From a few containers to a bulk tank.</small></div></div>
        <div><span className="benefit-number">02</span><div><strong>Know the estimate</strong><small>See water, delivery and estimated VAT separately.</small></div></div>
        <div><span className="benefit-number">03</span><div><strong>Prepare a supplier request</strong><small>Build a delivery request and review the details.</small></div></div>
      </section>

      <section className="marketplace-how" id="how-it-works">
        <div className="marketplace-section-heading"><span className="marketplace-kicker">A CLEARER WAY TO ORDER</span><h2>From water need to delivery request.</h2><p>Amanzi brings the order details and price estimate together, so households and local businesses can plan before they buy.</p></div>
        <div className="marketplace-steps">
          <article><span>1</span><h3>Tell us where</h3><p>Choose your delivery area and enter the address for a supplier to confirm.</p></article>
          <article><span>2</span><h3>Choose how much</h3><p>Select a volume that fits your household or business needs.</p></article>
          <article><span>3</span><h3>Review the estimate</h3><p>See the water price, delivery tier and estimated tax before requesting a quote.</p></article>
        </div>
      </section>

      <section className="marketplace-pricing-note">
        <div><span className="marketplace-kicker">TRANSPARENT BY DESIGN</span><h2>See what makes up the estimate.</h2></div>
        <div className="pricing-note-lines"><p><span>Water</span><strong>R1.00 / litre*</strong></p><p><span>Delivery</span><strong>R0.25 to R0.75 / litre*</strong></p><p><span>Example VAT</span><strong>15% of subtotal</strong></p><small>*Working assumptions for the hackathon prototype, not a supplier quote or confirmed tariff. Actual VAT depends on supplier registration and tax treatment.</small></div>
      </section>

      <section className="marketplace-business" id="business-model">
        <div className="marketplace-section-heading"><span className="marketplace-kicker">BUILT TO BE TESTED</span><h2>A simple model that can grow with demand.</h2><p>Amanzi can earn when a delivery succeeds, while repeat orders help suppliers plan routes and keep local service running.</p></div>
        <div className="marketplace-business-cards"><article><span>01</span><h3>Fee on fulfilled orders</h3><p>Agree a transparent platform fee with suppliers and charge it only when a delivery is completed.</p></article><article><span>02</span><h3>Repeat business supply</h3><p>Offer scheduled orders to shops, restaurants and other small businesses that need reliable water.</p></article><article><span>03</span><h3>Denser delivery routes</h3><p>Group nearby requests where practical to reduce wasted trips and improve delivery economics.</p></article></div>
        <p className="marketplace-model-caveat">The model still needs supplier quotes and a pilot. Validate water purchase cost, fuel, driver time, payment fees, VAT and failed deliveries before claiming savings or profit.</p>
      </section>
    </main>

    <footer className="marketplace-footer"><a href="/" aria-label="Amanzi home"><img src="/brand/amanzi-logo.png" alt="Amanzi" /></a><span>Making essential water easier to order.</span><button type="button" onClick={onAbout}>About Amanzi</button></footer>

    {requestOpen && <div className="order-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRequest() }}><section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="order-modal-title">
      <button className="order-modal-close" type="button" onClick={closeRequest} aria-label="Close order request">×</button>
      {requestSent ? <div className="order-success"><span className="order-success-mark" aria-hidden="true">&#10003;</span><span className="marketplace-kicker">REQUEST PREPARED</span><h2 id="order-modal-title">Your delivery request is ready.</h2><p>This is a prototype. Your contact details were not saved or sent to a supplier. Live supplier matching and quote confirmation still need to be connected.</p><button type="button" className="marketplace-primary" onClick={closeRequest}>Back to Amanzi</button></div> : <>
        <span className="marketplace-kicker">DELIVERY REQUEST</span><h2 id="order-modal-title">Where should we bring it?</h2><p className="order-modal-intro">{safeLitres.toLocaleString()} litres to {area || 'your chosen area'} · estimate {money(quote.total)}</p>
        <form className="delivery-request-form" onSubmit={submitRequest}>
          <label className="marketplace-field">Street address<input required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, building or nearest landmark" /></label>
          <div className="delivery-form-row"><label className="marketplace-field">Your name<input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Name" /></label><label className="marketplace-field">Phone number<input required value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="For supplier confirmation" /></label></div>
          <div className="order-breakdown"><p><span>Water · {safeLitres.toLocaleString()} L</span><strong>{money(quote.water)}</strong></p><p><span>Delivery · {safeLitres < 200 ? 'under 200 L tier' : safeLitres < 1000 ? '200 to 999 L tier' : '1,000 L and up'} at R{rate.toFixed(2)} per litre</span><strong>{money(quote.delivery)}</strong></p><p><span>Estimated VAT</span><strong>{money(quote.vat)}</strong></p><p className="order-breakdown-total"><span>Estimated total</span><strong>{money(quote.total)}</strong></p></div>
          <button className="marketplace-primary" type="submit">Prepare delivery request <span aria-hidden="true">→</span></button>
          <small className="order-form-disclaimer">No payment is taken. A supplier must confirm stock, delivery cost and timing before an order can be completed.</small>
        </form>
      </>}
    </section></div>}
  </div>
}
