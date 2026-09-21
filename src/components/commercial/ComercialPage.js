import React, { useState } from 'react';
import { useComercial } from '../../hooks/useComercial';
import { mesChave, somaMeses, rotuloMes } from '../../lib/entregas';
import { PageHeader } from '../shared/ui';
import ComercialLancamentos from './ComercialLancamentos';
import ComercialTVControl from './ComercialTVControl';

/*
 * Comercial (Hunters) — lançamentos e controle da TV da sala comercial.
 * Aparece no painel da CS para o líder (que é o líder do comercial) e
 * no admin. O mês anterior fica disponível para corrigir lançamentos
 * atrasados do fechamento.
 */
export default function ComercialPage({ clients, me, toast }) {
  const atual = mesChave();
  const [mes, setMes] = useState(atual);
  const [aba, setAba] = useState('lancamentos');
  const com = useComercial(mes);

  return (
    <div className="fade-up">
      <PageHeader
        title="Comercial · Hunters"
        sub="Tudo o que aparece na TV da sala comercial"
        right={(
          <>
            <button type="button" className={`ui-btn small ${aba === 'lancamentos' ? 'on' : ''}`} onClick={() => setAba('lancamentos')}>Lançamentos</button>
            <button type="button" className={`ui-btn small ${aba === 'tv' ? 'on' : ''}`} onClick={() => setAba('tv')}>Controle da TV</button>
          </>
        )}
      />

      {aba === 'lancamentos' ? (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[atual, somaMeses(atual, -1)].map(m => (
              <button key={m} type="button" className={`ui-btn small ${m === mes ? 'on' : ''}`} onClick={() => setMes(m)}>
                {rotuloMes(m, true)}
              </button>
            ))}
          </div>
          {com.loading ? (
            <div className="spinner" style={{ margin: '40px auto' }} />
          ) : (
            <ComercialLancamentos key={mes} com={com} clients={clients} mes={mes} me={me} toast={toast} />
          )}
        </>
      ) : (
        <ComercialTVControl config={com.config} saveConfig={com.saveConfig} toast={toast} />
      )}
    </div>
  );
}
