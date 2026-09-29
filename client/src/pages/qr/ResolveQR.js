import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resolveQR } from '../../api/useQR';
import Loader from '../../components/Loader';

// Target of every printed label (/qr/:code): looks the code up and opens the animal
const ResolveQR = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    resolveQR(code).then((result) => {
      if (!active) return;
      if (result.success) navigate(`/cattle/${result.data.cattle_id}`, { replace: true });
      else setError(result.error);
    });
    return () => { active = false; };
  }, [code, navigate]);

  if (!error) return <Loader />;

  return (
    <div className="container narrow">
      <div className="alert alert-error">{error}</div>
      <p className="muted">If the label was reissued, scan the new one or look the animal up in the cattle list.</p>
      <div className="card-actions">
        <Link to="/scan" className="btn btn-primary">Scan again</Link>
        <Link to="/cattle" className="btn btn-outline">Cattle list</Link>
      </div>
    </div>
  );
};

export default ResolveQR;
