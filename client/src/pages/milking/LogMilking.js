import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMilking } from '../../api/useMilking';
import MilkingForm, { emptyRecord } from './MilkingForm';
import '../../styles/tables.css';
import '../../styles/milking.css';

// /milking/log?cattle=3 preselects a cow (used from the cattle profile)
const LogMilking = () => {
  const { createRecord } = useMilking();
  const [params] = useSearchParams();
  const initial = { ...emptyRecord(), cattle_id: params.get('cattle') || '' };

  return (
    <div className="container narrow">
      <div className="page-header">
        <div>
          <h1>Log milking</h1>
          <p className="muted">One entry per cow per session.</p>
        </div>
      </div>
      <MilkingForm initial={initial} onSubmit={createRecord} submitLabel="Save record" keepOpen />
    </div>
  );
};

export default LogMilking;
