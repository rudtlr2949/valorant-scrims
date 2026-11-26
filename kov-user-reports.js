const el = (tag, text, className) => {
  const node = document.createElement(tag); if (text) node.textContent = text;
  if (className) node.className = className; return node;
};
const token = () => { try { return localStorage.getItem('discordToken'); } catch { return null; } };
async function reportRequest(method, body, query = '') {
  const response = await fetch('/api/kov-user-reports' + query, { method, headers: {
    ...(token() ? { Authorization: 'Bearer ' + token() } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || '신고함에 연결하지 못했습니다.');
  return data;
}
export function openUserReport(team, person) {
  document.querySelector('.kov-report-dialog')?.close();
  const dialog = el('dialog', '', 'kov-report-dialog');
  dialog.setAttribute('aria-labelledby', 'kov-report-title');
  const form = el('form', '', 'kp-form');
  const heading = el('h2', '유저 신고'); heading.id = 'kov-report-title';
  const target = el('p', `${team.name} · ${person.name}${person.tag ? ' · ' + person.tag : ''}`, 'kp-meta');
  const notice = el('p', '신고 내용과 신고자 정보는 운영진만 확인합니다. 운영진 검토 후 처리되며 자동으로 제재되지 않습니다.', 'kp-meta');
  const field = (label, input) => { const wrapper = el('label', label, 'kp-field'); wrapper.append(input); return wrapper; };
  const reason = el('select'); reason.name = 'reason'; reason.required = true;
  for (const value of ['', '욕설·괴롭힘', '부정행위 의심', '사칭·허위 정보', '비매너·규정 위반', '기타']) {
    const option = el('option', value || '사유를 선택해 주세요'); option.value = value; reason.append(option);
  }
  const details = el('textarea'); details.name = 'details'; details.required = true; details.minLength = 10; details.maxLength = 1500;
  details.placeholder = '발생 일시와 상황을 구체적으로 적어 주세요. (10~1500자)'; details.rows = 5;
  const evidence = el('input'); evidence.name = 'evidence'; evidence.type = 'url'; evidence.maxLength = 500;
  evidence.placeholder = 'https://…';
  const status = el('p', '', 'kp-meta'); status.setAttribute('role', 'status');
  const actions = el('div', '', 'kp-actions');
  const cancel = el('button', '취소', 'kp-button'); cancel.type = 'button'; cancel.onclick = () => dialog.close();
  const submit = el('button', '신고 접수', 'kp-button danger'); submit.type = 'submit';
  actions.append(cancel, submit);
  form.append(heading, target, notice, field('신고 사유', reason), field('상세 내용', details), field('증거 링크 (선택)', evidence), status, actions);
  if (!token()) {
    const login = el('button', 'Discord 로그인', 'kp-button primary'); login.type = 'button';
    status.textContent = '신고 접수에는 Discord 로그인이 필요합니다.';
    login.onclick = () => { dialog.close(); document.querySelector('[data-action="login"]')?.click(); };
    submit.disabled = true; actions.prepend(login);
  }
  form.onsubmit = async event => {
    event.preventDefault(); submit.disabled = true; status.textContent = '신고를 접수하고 있습니다…';
    try {
      const result = await reportRequest('POST', { source: team.url, targetId: person.id,
        reason: reason.value, details: details.value, evidence: evidence.value });
      status.textContent = `신고가 접수됐습니다. 접수 번호 ${result.receipt}`;
      reason.disabled = details.disabled = evidence.disabled = true; submit.remove(); cancel.textContent = '닫기';
    } catch (error) { status.textContent = error.message; submit.disabled = false; }
  };
  dialog.append(form); document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}

class UserReportInbox extends HTMLElement {
  async connectedCallback() {
    const heading = el('h2', '유저 신고함');
    const controls = el('div', '', 'kp-actions');
    const label = el('label', '접수 날짜 · 한국시간 ', 'kp-field');
    const day = el('input'); day.type = 'date'; day.value = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); label.append(day);
    const refresh = el('button', '신고 조회', 'kp-button'); refresh.type = 'button';
    const status = el('p', '', 'kp-meta'); status.setAttribute('role', 'status');
    const list = el('div', '', 'kov-report-inbox-list');
    const more = el('button', '더 보기', 'kp-button'); more.type = 'button'; more.hidden = true;
    let cursor = null;
    const load = async (append = false) => {
      refresh.disabled = more.disabled = true; status.textContent = '운영진 신고함을 확인하고 있습니다…';
      try {
        const query = new URLSearchParams({ day: day.value }); if (append && cursor) query.set('cursor', cursor);
        const data = await reportRequest('GET', null, '?' + query);
        if (!append) list.replaceChildren();
        for (const report of data.reports) {
          const card = el('article', '', 'kp-panel kp-pad kov-report-item');
          card.append(el('h3', `${report.target.name} · ${report.team.name}`),
            el('p', `${report.reason} · ${new Date(report.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`, 'kp-meta'),
            el('p', `신고자 ${report.reporter.name} (${report.reporter.id}) · 대상 ${report.target.id}`, 'kp-meta'),
            el('p', report.details, 'kov-report-content'));
          if (report.evidence) { const link = el('a', '증거 링크 ↗', 'kp-button small'); link.href = report.evidence; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link); }
          const review = el('div', '', 'kp-actions');
          const current = el('span', '', 'kp-meta');
          const stateLabel = { pending: '검토 대기', handled: '처리 완료', dismissed: '반려' };
          current.textContent = stateLabel[report.status] || '검토 대기'; review.append(current);
          for (const [value, text] of Object.entries(stateLabel)) {
            const button = el('button', text, 'kp-button small'); button.type = 'button';
            button.onclick = async () => {
              button.disabled = true;
              try { await reportRequest('PATCH', { id: report.id, status: value }); current.textContent = text; }
              catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
            }; review.append(button);
          }
          card.append(review); list.append(card);
        }
        cursor = data.cursor; more.hidden = !cursor;
        status.textContent = list.children.length ? `${list.children.length}건 표시` : '선택한 날짜에 접수된 신고가 없습니다.';
      } catch (error) { status.textContent = error.message; }
      finally { refresh.disabled = more.disabled = false; }
    };
    refresh.onclick = () => load(); day.onchange = () => load(); more.onclick = () => load(true);
    controls.append(label, refresh); this.replaceChildren(heading, controls, status, list, more); void load();
  }
}
customElements.define('kov-user-report-inbox', UserReportInbox);
