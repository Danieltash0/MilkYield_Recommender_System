import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../../api/useFinance';
import FinanceForm, { emptyFinance } from './FinanceForm';
import '../../styles/finance.css';

const AddFinance = () => {
  const { createRecord } = useFinance();
  const navigate = useNavigate();

  const handleSubmit = async (form) => {
    const result = await createRecord(form);
    if (result.success) navigate('/finance');
    return result;
  };

  return (
    <div className="container narrow">
      <div className="page-header"><h1>New transaction</h1></div>
      <FinanceForm initial={emptyFinance()} onSubmit={handleSubmit} submitLabel="Save" />
    </div>
  );
};

export default AddFinance;
