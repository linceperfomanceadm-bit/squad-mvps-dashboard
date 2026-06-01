import React from 'react';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { SM_COLUMNS } from '../../../lib/firebase';

function PostCard({ post, onStatusChange }) {
  const isLate = post.date && differenceInDays(new Date(), new Date(post.date)) > 0 && post.status !== 'published';
  const isStuck = post.status === 'client' && differenceInDays(new Date(), new Date(post.updatedAt || post.createdAt)) >= 3;

  return (
    <div style={{ background: 'rgba(12,12,24,.9)', border: `1px solid ${isLate || isStuck ? 'rgba(238,51,99,.35)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8, animation: 'fadeUp .2s ease' }}>
      {(isLate || isStuck) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <AlertTriangle size={11} color="var(--neon)" style={{ animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 10, color: 'var(--neon)', fontFamily: 'var(--fm)', fontWeight: 600 }}>
            {isStuck ? '+3 DIAS COM CLIENTE' : 'DATA ATRASADA'}
          </span>
        </div>
      )}
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{post.name}</p>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{post.clientName}</p>
      {post.date && (
        <p style={{ fontSize: 11, color: isLate ? 'var(--neon)' : 'var(--muted)', fontFamily: 'var(--fm)', marginBottom: 8 }}>
          📅 {format(new Date(post.date), "dd 'de' MMM", { locale: ptBR })}
        </p>
      )}
      {post.linkArt && (
        <a href={post.linkArt} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--blue)', textDecoration: 'none', marginBottom: 10 }}>
          <ExternalLink size={11} /> Ver arte
        </a>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {SM_COLUMNS.filter(c => c.id !== post.status).map(col => (
          <button
            key={col.id}
            onClick={() => onStatusChange(post.clientId, post.id, col.id)}
            style={{ background: `${col.color}15`, border: `1px solid ${col.color}30`, borderRadius: 6, padding: '3px 9px', color: col.color, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--fm)' }}
          >
            → {col.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SMKanban({ myPosts, onStatusChange }) {
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Kanban</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>{myPosts.length} post{myPosts.length !== 1 ? 's' : ''} no total</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, alignItems: 'start' }}>
        {SM_COLUMNS.map(col => {
          const posts = myPosts.filter(p => p.status === col.id);
          return (
            <div key={col.id} style={{ background: 'rgba(12,12,24,.6)', border: `1px solid ${col.color}20`, borderRadius: 12, padding: '12px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '0 4px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: col.color, fontFamily: 'var(--fm)' }}>{col.label}</span>
                <span style={{ background: `${col.color}20`, borderRadius: 10, padding: '1px 8px', fontSize: 11, color: col.color, fontFamily: 'var(--fm)' }}>{posts.length}</span>
              </div>
              {posts.length === 0
                ? <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>Vazio</p>
                : posts.map(p => <PostCard key={p.id} post={p} onStatusChange={onStatusChange} />)
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}
