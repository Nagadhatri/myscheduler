import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:3000/api/reports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // We need to bypass auth or auth is required.
      // Wait, api/reports requires supabase auth.
    },
    body: JSON.stringify({
      reportType: 'weekly',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-07'
    })
  });
  const text = await res.text();
  console.log(res.status, text);
}
test();
