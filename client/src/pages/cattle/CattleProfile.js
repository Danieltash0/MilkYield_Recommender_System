import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, ROLES } from '../../context/AuthContext';
import { useCattle } from '../../api/useCattle';
import { healthClass } from '../../components/CattleCard';
import Loader from '../../components/Loader';

const fmt = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString() : 'Not specified');

const ageOf = (dob) => {
  if (!dob) return null;
  const months = Math.floor((Date.now() - new Date(dob + 'T00:00:00')) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 0) return null;
  return months < 24 ? `${months} month${months === 1 ? '' : 's'}` : `${Math.floor(months / 12)} years`;
};

const CattleProfile = () => {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const { getCattleById } = useCattle();
  const [cow, setCow] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let active = true;
    getCattleById(id).then((c) => active && setCow(c));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (cow === undefined) return <Loader />;
  if (cow === null) {
    return (
      <div className="container narrow">
        <div className="alert alert-error">Cattle not found.</div>
        <Link to="/cattle" className="btn btn-outline">Back to cattle</Link>
      </div>
    );
  }

  const age = ageOf(cow.date_of_birth);

  return (
    <div className="container narrow">
      <div className="page-header">
        <div>
          <h1>{cow.name || 'Unnamed'}</h1>
          <p className="muted">Tag {cow.tag_number}</p>
        </div>
        <span className={healthClass(cow.health)}>{cow.health}</span>
      </div>

      <div className="card">
        <dl className="details">
          <div><dt>Breed</dt><dd>{cow.breed || '—'}</dd></div>
          <div><dt>Gender</dt><dd>{cow.gender}</dd></div>
          <div><dt>Date of birth</dt><dd>{fmt(cow.date_of_birth)}{age && ` (${age})`}</dd></div>
          <div><dt>Registered</dt><dd>{new Date(cow.created_at.replace(' ', 'T')).toLocaleDateString()}</dd></div>
          <div className="full"><dt>Notes</dt><dd>{cow.notes || '—'}</dd></div>
        </dl>
        <div className="card-actions">
          <Link to="/cattle" className="btn btn-secondary">Back</Link>
          {cow.gender === 'Female' && (
            <Link to={`/cattle/${cow.cattle_id}/milk`} className="btn btn-outline">Milk history</Link>
          )}
          {hasRole(ROLES.ADMIN, ROLES.MANAGER) && (
            <Link to={`/cattle/${cow.cattle_id}/edit`} className="btn btn-primary">Edit</Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default CattleProfile;
