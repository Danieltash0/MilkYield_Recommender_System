import React from 'react';
import { Link } from 'react-router-dom';

export const healthClass = (h) => `health health-${(h || 'Good').toLowerCase()}`;

const CattleCard = ({ cow, canManage, onEdit, onDelete }) => {
  const id = cow.cattle_id;
  return (
    <div className="card cattle-card">
      <div className="cattle-card-head">
        <div className="avatar" aria-hidden="true">{(cow.name || cow.tag_number || '?').charAt(0).toUpperCase()}</div>
        <div>
          <h3>{cow.name || 'Unnamed'}</h3>
          <span className="muted">Tag {cow.tag_number}</span>
        </div>
        <span className={healthClass(cow.health)}>{cow.health}</span>
      </div>
      <dl className="cattle-meta">
        <div><dt>Breed</dt><dd>{cow.breed || '—'}</dd></div>
        <div><dt>Category</dt><dd>{cow.category || '—'}</dd></div>
        <div><dt>D.O.B</dt><dd>{cow.date_of_birth ? new Date(cow.date_of_birth + 'T00:00:00').toLocaleDateString() : '—'}</dd></div>
      </dl>
      <div className="card-actions">
        <Link to={`/cattle/${id}`} className="btn btn-outline btn-sm">View</Link>
        {canManage && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(cow)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(cow)}>Delete</button>
          </>
        )}
      </div>
    </div>
  );
};

export default CattleCard;
