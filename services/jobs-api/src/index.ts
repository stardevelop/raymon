import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/healthz", async () => ({ ok: true }));

app.post("/v1/jobs/text.generate", async (req, reply) => {
  // TODO: auth, quotas, idempotency
  const jobId = "job_" + Math.random().toString(36).slice(2);
  reply.code(202).send({ job_id: jobId, status: "pending" });
});

app.get("/v1/jobs/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  reply.send({ id, status: "completed", result: { content: "hello world" } });
});

app.get("/v1/jobs/:id/stream", async (req, reply) => {
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.flushHeaders();

  const chunks = ["hi", " ", "there", " ", "👋"];
  for (const t of chunks) {
    reply.raw.write(`event: token
data: ${JSON.stringify(t)}

`);
    await new Promise(r => setTimeout(r, 300));
  }
  reply.raw.write(`event: complete
data: {}

`);
  reply.raw.end();
});

const port = Number(process.env.PORT || 8088);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  console.log("Jobs API listening on", port);
});