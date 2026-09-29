import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHealthRecords } from '../../api/useHealth';
import HealthRecordForm, { emptyHealthRecord } from './HealthRecordForm';
import '../../styles/health.css';

// /health/add?cattle=3 preselects an animal (used from the cattle profile)
const AddHealthRecord = () => {
  const { createRecord } = useHealthRecords();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = { ...emptyHealthRecord(), cattle_id: params.get('cattle') || '' };

  const handleSubmit = async (form) => {
    const result = await createRecord(form);
    if (result.success) navigate(`/health?cattle_id=${form.cattle_id}`);
    return result;
  };

  return (
    <div className="container narrow">
      <div className="page-header"><h1>New health record</h1></div>
      <HealthRecordForm initial={initial} onSubmit={handleSubmit} submitLabel="Save record" />
    </div>
  );
};

export default AddHealthRecord;
