import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

// This is a simulation for the user's request: "notificação chegue no email: louisenaely@gmail.com"
async function sendNotificationEmail(taskTitle: string) {
  const targetEmail = "louisenaely@gmail.com";
  console.log(`[SIMULATION] Sending Email Notification to ${targetEmail}`);
  console.log(`[SIMULATION] Subject: Tarefa Agendada: ${taskTitle}`);
  console.log(`[SIMULATION] Body: Olá Naely, é hora de realizar: ${taskTitle}`);
  console.log(`[SIMULATION] Sent at: ${new Date().toISOString()}`);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Agenda da Naely Server Running" });
  });

  app.post("/api/notify", async (req, res) => {
    const { title } = req.body;
    await sendNotificationEmail(title);
    res.json({ success: true, message: "Email simulation logged" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
