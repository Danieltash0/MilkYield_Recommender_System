import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useHealthRecords, getHealthRecord } from '../../api/useHealth';
import Loader from '../../components/Loader';
import HealthRecordForm, { emptyHealthRecord } from './HealthRecordForm';
import '../../styles/health.css';

const EditHealthRecord = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateRecord } = useHealthRecords();
  const [initial, setInitial] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let active = true;
    getHealthRecord(id).then((r) => {
      if (!active) return;
      if (!r) return setInitial(null);
      // Null columns become '' so the inputs stay controlled
      const blank = emptyHealthRecord();
      setInitial(Object.fromEntries(Object.keys(blank).map((k) => [k, r[k] ?? ''])));
    });
    return () => { active = false; };
  }, [id]);

  const handleSubmit = async (form) => {
    const result = await updateRecord(id, form);
    if (result.success) navigate(`/health?cattle_id=${form.cattle_id}`);
    return result;
  };

  if (initial === undefined) return <Loader />;
  if (initial === null) {
    return (
      <div className="container narrow">
        <div className="alert alert-error">Health record not found.</div>
        <Link to="/health" className="btn btn-outline">Back to health records</Link>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <div className="page-header"><h1>Edit health record</h1></div>
      <HealthRecordForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" />
    </div>
  );
};

export default EditHealthRecord;
