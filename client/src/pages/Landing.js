import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import Logo from '../components/Logo';
import calvesPhoto from '../assets/images/calves-hillside.webp';
import barnPhoto from '../assets/images/dairy-barn.webp';
import farmPhoto from '../assets/images/kenya-smallholder-farm.webp';
import sunsetPhoto from '../assets/images/cattle-sunset-pasture.webp';
import '../styles/landing.css';

const steps = [
  { title: 'Register your herd', text: 'Add each animal once, with its tag, breed and date of birth, and print its QR label.' },
  { title: 'Log the day', text: 'Workers record every milking session and tick off their tasks from the field.' },
  { title: 'See what needs attention', text: 'Dashboards surface the cows, check-ups and jobs that need you today.' }
];

// `soon` marks what is not built yet
const features = [
  { icon: 'tag', title: 'Cattle records', text: 'Every animal’s tag, breed, health status and notes, findable in seconds.' },
  { icon: 'qr', title: 'QR identification', text: 'Scan a cow’s tag in the field to open her profile.' },
  { icon: 'pulse', title: 'Veterinary care', text: 'Health records and vet appointments, linked to each animal.' },
  { icon: 'checklist', title: 'Daily tasks', text: 'Assign feeding, cleaning and milking jobs and track them to done.' },
  { icon: 'lock', title: 'Role-based access', text: 'Each person sees and does only what their role allows.' },
  { icon: 'trend', title: 'Milk yield recommender', soon: true, text: 'A per-cow forecast with an early alert when her yield drops.' }
];

const roles = [
  { name: 'Farm Manager', text: 'Oversees the herd, assigns work and tracks income and expenses.' },
  { name: 'Veterinarian', text: 'Records diagnoses and treatments, and manages appointments.' },
  { name: 'Worker', text: 'Registers animals, logs milking sessions and completes tasks.' },
  { name: 'Admin', text: 'Manages accounts, reviews activity and configures the farm.' }
];

// Sample figures for the hero illustration only (not live data)
const previewBars = [62, 78, 70, 85, 74, 92, 80];

const Landing = () => (
  <div className="lp">
    <header className="lp-nav">
      <div className="lp-wrap lp-nav-inner">
        <span className="brand"><Logo />DairyDan</span>
        <nav aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#roles">Who it’s for</a>
          <Link to="/login" className="lp-nav-login">Log in</Link>
          <Link to="/signup" className="lp-btn lp-btn-accent lp-btn-sm">Get started</Link>
        </nav>
      </div>
    </header>

    {/* Hero: copy on the left, photo collage on the right */}
    <section className="lp-hero">
      <div className="lp-wrap lp-hero-inner">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">Dairy farm management for Kenya</p>
          <h1>Know every cow. <span className="lp-accent-text">Grow every litre.</span></h1>
          <p className="lp-hero-sub">
            DairyDan helps smallholder and mid-scale dairy farmers keep clean herd records, coordinate
            their team, and spot milk yield problems before they cost money.
          </p>
          <div className="lp-hero-actions">
            <Link to="/signup" className="lp-btn lp-btn-accent lp-btn-lg">
              Get started free <Icon name="arrow" size={20} />
            </Link>
            <a href="#how" className="lp-btn lp-btn-outline lp-btn-lg">See how it works</a>
          </div>
          <p className="lp-hero-note">Free to use · Works on any phone or computer</p>
        </div>

        <div className="lp-collage">
          <img className="lp-collage-main" src={calvesPhoto} alt="Three dairy calves standing on a green hillside" width="1600" height="900" />
          <img className="lp-collage-side" src={barnPhoto} alt="Tagged dairy cows eating at a feed barrier" width="1600" height="900" />
          {/* Decorative sample card: hidden from screen readers so it is not read out as a fact */}
          <div className="lp-collage-card" aria-hidden="true">
            <span className="lp-card-label">Milk today</span>
            <strong>75.7 L</strong>
            <div className="lp-card-bars">
              {previewBars.map((h, i) => (
                <span key={i} style={{ height: `${h}%` }} className={i === previewBars.length - 1 ? 'is-today' : undefined} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* How it works: three connected steps */}
    <section id="how" className="lp-section lp-how">
      <div className="lp-wrap">
        <p className="lp-kicker">How it works</p>
        <h2 className="lp-center">From ear tag to insight in three steps</h2>
        <ol className="lp-steps">
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className="lp-step-num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>

    {/* Features: heading stays put on the left while the list scrolls on the right */}
    <section id="features" className="lp-section lp-section-cream">
      <div className="lp-wrap lp-features">
        <div className="lp-features-intro">
          <p className="lp-kicker">Features</p>
          <h2>Everything the farm needs, in one place</h2>
          <p>
            Herd records, milking, health, tasks, QR tags and reports work together, so the whole team
            is looking at the same up-to-date picture.
          </p>
          <Link to="/signup" className="lp-btn lp-btn-primary">
            Create an account <Icon name="arrow" size={18} />
          </Link>
        </div>
        <ul className="lp-feature-list">
          {features.map((f) => (
            <li key={f.title}>
              <span className="lp-feature-icon"><Icon name={f.icon} size={24} /></span>
              <div>
                <h3>{f.title}{f.soon && <span className="lp-tag">Coming next</span>}</h3>
                <p>{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>

    {/* Roles: dark band with a wide photo and four columns */}
    <section id="roles" className="lp-section lp-roles">
      <div className="lp-wrap">
        <div className="lp-roles-head">
          <h2>Built for the whole team</h2>
          <p>Everyone signs in to the same farm, and sees the tools their job needs.</p>
        </div>
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
        <ol className="lp-role-cols">
          {roles.map((r, i) => (
            <li key={r.name}>
              <span className="lp-role-num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{r.name}</h3>
              <p>{r.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>

    {/* Closing call to action: photo on one half, message on the other */}
    <section className="lp-section">
      <div className="lp-wrap">
        <div className="lp-cta">
          <img src={sunsetPhoto} alt="Cattle grazing on a hillside pasture at sunset" loading="lazy" width="1600" height="900" />
          <div className="lp-cta-copy">
            <h2>Ready to get your herd in order?</h2>
            <p>Create an account, register your first cow and log today’s milk.</p>
            <div className="lp-cta-actions">
              <Link to="/signup" className="lp-btn lp-btn-accent lp-btn-lg">
                Sign up free <Icon name="arrow" size={20} />
              </Link>
              <Link to="/login" className="lp-text-link">or log in</Link>
            </div>
          </div>
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
