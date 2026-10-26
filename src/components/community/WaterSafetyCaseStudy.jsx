import { useEffect, useState } from 'react'
import './water-safety-case-study.css'

const phases = [
  {
    title: 'Community signal',
    eyebrow: 'UNVERIFIED OBSERVATIONS',
    body: 'Residents can report unusual taste, smell, colour or illness concerns in their area. Amanzi marks each post as a community observation. Confirmations show that neighbours noticed something too; they never prove water is safe or unsafe.',
    preview: 'A neighbour reported a water safety concern in your saved area. This is an unverified community observation. Check the official source before using tap water.',
  },
  {
    title: 'Official warning',
    eyebrow: 'SOURCE-LINKED GUIDANCE',
    body: 'For the Bronkhorstspruit incident, the City of Tshwane published a warning on 20 October 2026. Amanzi would display the authority, publication date, affected locations and the original notice together, then alert people following those locations.',
    preview: 'Official water warning for Bronkhorstspruit. Follow the City of Tshwane notice. Tap water is restricted to toilet flushing; do not use it for other purposes, even after boiling.',
  },
  {
    title: 'Treatment underway',
    eyebrow: 'KEEP THE WARNING VISIBLE',
    body: 'A treatment update is not a safety clearance. The City notice on 21 October said the restriction remained in place while treatment continued. Amanzi would keep the warning active and show the newer source without treating a chlorine smell or neighbour confirmation as proof of safety.',
    preview: 'Water treatment is underway, but the official restriction remains active. A chlorine smell does not confirm the water is safe. Read the latest City update.',
  },
  {
    title: 'Official clearance',
    eyebrow: 'CLOSE ONLY WITH A SOURCE',
    body: 'Amanzi should only mark the incident cleared after a new notice from the responsible authority explicitly confirms the affected supply is safe. The clearance source and time remain visible in the incident history. This walkthrough does not claim such a clearance was issued.',
    preview: 'No clearance is simulated here. The warning stays active until an official source confirms the water is safe for use.',
  },
]

export default function WaterSafetyCaseStudy({ isOpen, onClose }) {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null
  const phase = phases[phaseIndex]

  return <div className="water-safety-overlay" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="water-safety-dialog" role="dialog" aria-modal="true" aria-labelledby="water-safety-title">
      <header className="water-safety-heading">
        <div><span className="water-safety-kicker">CASE STUDY · BRONKHORSTSPRUIT · OCTOBER 2026</span><h2 id="water-safety-title">How Amanzi could help during a water safety incident</h2></div>
        <button className="water-safety-close" type="button" onClick={onClose} aria-label="Close case study"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button>
      </header>
      <p className="water-safety-disclaimer"><strong>Workflow demonstration, not a live alert.</strong> Amanzi is not connected to a municipal notice feed and cannot test water or determine whether it is safe. Check the authority’s current notice before acting.</p>
      <div className="water-safety-phases" role="tablist" aria-label="Incident response steps">
        {phases.map((item, index) => <button key={item.title} type="button" role="tab" aria-selected={index === phaseIndex} className={index === phaseIndex ? 'active' : ''} onClick={() => { setPhaseIndex(index); setShowPreview(false) }}><span>{String(index + 1).padStart(2, '0')}</span>{item.title}</button>)}
      </div>
      <article className="water-safety-phase" role="tabpanel">
        <span className="water-safety-phase-kicker">{phase.eyebrow}</span>
        <h3>{phase.title}</h3>
        <p>{phase.body}</p>
      </article>
      {showPreview && <div className="water-safety-alert-preview" role="status"><span>RESIDENT ALERT PREVIEW · NOT SENT</span><p>{phase.preview}</p></div>}
      <div className="water-safety-actions"><button type="button" className="water-safety-preview-button" onClick={() => setShowPreview((value) => !value)}>{showPreview ? 'Hide alert preview' : 'Preview resident alert'}</button><div className="water-safety-sources"><span>Official sources</span><a href="https://www.tshwane.gov.za/?p=106260" target="_blank" rel="noreferrer">City warning, 20 Oct ↗</a><a href="https://www.tshwane.gov.za/?p=106303" target="_blank" rel="noreferrer">Treatment update, 21 Oct ↗</a><a href="https://www.gov.za/news/media-statements/joint-media-statement-ministries-health-water-and-sanitation-gauteng" target="_blank" rel="noreferrer">Joint government statement ↗</a></div></div>
      <footer className="water-safety-footnote">Community reports do not reach or receive acknowledgement from the municipality through Amanzi. Residents must use the official reporting channel for faults and emergencies.</footer>
    </section>
  </div>
}
