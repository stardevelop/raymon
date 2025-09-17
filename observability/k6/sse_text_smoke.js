import http from 'k6/http';
import { sleep, check } from 'k6';

export default function () {
  const create = http.post('http://localhost:8088/v1/jobs/text.generate', JSON.stringify({workspace_id:"wk1",input:{prompt:"hi"}}), { headers: { 'Content-Type':'application/json' }});
  check(create, { '202': r => r.status === 202 });
  const { job_id } = JSON.parse(create.body);
  const res = http.get(`http://localhost:8088/v1/jobs/${job_id}/stream`, { headers: { Accept: 'text/event-stream' } });
  check(res, { '200': r => r.status === 200 });
  sleep(1);
}