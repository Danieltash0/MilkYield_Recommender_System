import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import Logo from '../components/Logo';
import farmPhoto from '../assets/images/kenya-smallholder-farm.webp';
import '../styles/landing.css';

// `wide` cards take half the row; the rest take a third. `soon` marks what is not built yet.
const features = [
  { icon: 'tag', title: 'Cattle records', wide: true, text: 'Register every animal with its tag, breed, health status and notes, and find any record in seconds.' },
  { icon: 'trend', title: 'Milk yield recommender', wide: true, soon: true, text: 'A moving-average forecast with breed-based fallbacks, and an early alert when a cow’s yield drops.' },
  { icon: 'qr', title: 'QR identification', text: 'Each animal gets a QR tag, so workers can pull up its profile in the field.' },
  { icon: 'pulse', title: 'Veterinary care', text: 'Health records and vet appointments in one place, linked to each animal.' },
  { icon: 'checklist', title: 'Daily tasks', text: 'Assign feeding, cleaning and milking tasks, and tick them off as the day goes.' },
  { icon: 'lock', title: 'Role-based access', text: 'Managers, vets, workers and admins each see and do only what their role allows.' }
];

const roles = [
  { name: 'Farm Manager', text: 'Oversees the herd, edits records, assigns work and tracks income and expenses.' },
  { name: 'Veterinarian', text: 'Reviews animals, records diagnoses and treatments, and manages appointments.' },
  { name: 'Worker', text: 'Registers animals, logs each milking session and completes daily tasks.' },
  { name: 'Admin', text: 'Manages user accounts, reviews the activity log and configures farm settings.' }
];

// Sample figures for the hero illustration only (not live data)
const previewBars = [62, 78, 70, 85, 74, 92, 80];

// A stylised glimpse of the app, built from the same cards the dashboards use.
// Decorative: hidden from screen readers so sample numbers are not read out as facts.
const HeroPreview = () => (
  <div className="lp-preview" aria-hidden="true">
    <div className="lp-preview-card lp-preview-milk">
      <span className="lp-preview-label">Milk today</span>
      <strong>75.7 L</strong>
      <div className="lp-preview-bars">
        {previewBars.map((h, i) => (
          <span key={i} style={{ height: `${h}%` }} className={i === previewBars.length - 1 ? 'is-today' : undefined} />
        ))}
      </div>
    </div>
    <div className="lp-preview-card lp-preview-cow">
      <span className="lp-preview-avatar">M</span>
      <div>
        <strong>Molly</strong>
        <span className="lp-preview-label">Tag CT003 · Ayrshire</span>
      </div>
      <span className="lp-preview-pill">Check-up due</span>
    </div>
    <div className="lp-preview-card lp-preview-tasks">
      <span className="lp-preview-label">Morning round</span>
      <ul>
        <li className="is-done"><Icon name="check" size={16} /> Clean milking equipment</li>
        <li className="is-done"><Icon name="check" size={16} /> Milk all cows</li>
        <li><span className="lp-preview-box" /> Record yields</li>
      </ul>
    </div>
  </div>
);

const Landing = () => (
  <div className="lp">
    <header className="lp-nav">
      <div className="lp-wrap lp-nav-inner">
        <span className="brand"><Logo />DairyDan</span>
        <nav aria-label="Main">
          <a href="#features">Features</a>
          <a href="#roles">Who it’s for</a>
          <Link to="/login" className="lp-nav-login">Log in</Link>
          <Link to="/signup" className="lp-btn lp-btn-accent lp-btn-sm">Get started</Link>
        </nav>
      </div>
    </header>

    <section className="lp-hero">
      <div className="lp-wrap lp-hero-inner">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">Dairy farm management for Kenya</p>
          <h1>Know every cow.<br /><span className="lp-underline">Grow every litre.</span></h1>
          <p className="lp-hero-sub">
            DairyDan helps smallholder and mid-scale dairy farmers keep clean herd records, coordinate
            their team, and spot milk yield problems before they cost money.
          </p>
          <div className="lp-hero-actions">
            <Link to="/signup" className="lp-btn lp-btn-accent lp-btn-lg">
              Create a free account <Icon name="arrow" size={20} />
            </Link>
            <Link to="/login" className="lp-text-link">I already have an account</Link>
          </div>
          <ul className="lp-hero-points">
            <li><Icon name="check" size={18} /> A QR tag for every cow</li>
            <li><Icon name="check" size={18} /> Milk logged per session</li>
            <li><Icon name="check" size={18} /> Reports as PDF</li>
          </ul>
        </div>
        <HeroPreview />
      </div>
      {/* Curved edge into the next section */}
      <svg className="lp-hero-curve" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 80V40C240 0 480 0 720 26s480 40 720 6v48z" />
      </svg>
    </section>

    <section id="features" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-section-head">
          <h2>Everything the farm needs, in one place</h2>
          <p>
            Herd records, milking, health, tasks, QR tags and reports work together, so the whole team
            is looking at the same up-to-date picture.
          </p>
        </div>
        <div className="lp-features">
          {features.map((f) => (
            <article className={`lp-feature${f.wide ? ' is-wide' : ''}`} key={f.title}>
              <div className="lp-feature-top">
                <span className="lp-feature-icon"><Icon name={f.icon} size={26} /></span>
                <span className={`lp-tag${f.soon ? ' is-soon' : ''}`}>{f.soon ? 'Coming next' : 'Live'}</span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
        <div className="lp-inline-cta">
          <p>Set up your herd in a few minutes.</p>
          <Link to="/signup" className="lp-btn lp-btn-primary">
            Get started <Icon name="arrow" size={18} />
          </Link>
        </div>
      </div>
    </section>

    <section id="roles" className="lp-section lp-section-tint">
      <div className="lp-wrap lp-roles">
        <figure className="lp-roles-photo">
          <img src={farmPhoto} alt="Dairy cows grazing behind a pole fence on a smallholder farm in Bomet, Kenya" loading="lazy" width="1600" height="900" />
          {/* CC BY-SA 4.0 requires this credit wherever the photo is shown */}
          <figcaption>
            “Dairy Farming in Bomet, Kenya” by Korirhilla,{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>, via{' '}
            <a href="https://commons.wikimedia.org/wiki/File:Dairy_Farming_in_Bomet,_Kenya.jpg" target="_blank" rel="noreferrer">Wikimedia Commons</a>{' '}
            (cropped and resized)
          </figcaption>
        </figure>
        <div className="lp-roles-copy">
          <h2>Built for the whole team</h2>
          <p className="lp-roles-intro">Everyone signs in to the same farm, and sees the tools their job needs.</p>
          <ol className="lp-role-list">
            {roles.map((r, i) => (
              <li key={r.name}>
                <span className="lp-role-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{r.name}</h3>
                  <p>{r.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>

    <section className="lp-section">
      <div className="lp-wrap">
        <div className="lp-cta">
          <div>
            <h2>Ready to get your herd in order?</h2>
            <p>Create an account, register your first cow and log today’s milk.</p>
          </div>
          <Link to="/signup" className="lp-btn lp-btn-accent lp-btn-lg">
            Sign up free <Icon name="arrow" size={20} />
          </Link>
        </div>
      </div>
    </section>

    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-inner">
        <span className="brand"><Logo />DairyDan</span>
        <p>© {new Date().getFullYear()} DairyDan · Research project</p>
      </div>
    </footer>
  </div>
);

export default Landing;
