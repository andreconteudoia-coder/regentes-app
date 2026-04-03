// Google Calendar OAuth2 and events API example for Node.js backend
// 1. Instale: npm install googleapis express cookie-session dotenv
// 2. Crie um arquivo .env com suas credenciais:
//    GOOGLE_CLIENT_ID=...
//    GOOGLE_CLIENT_SECRET=...
//    GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback

const express = require('express');
const { google } = require('googleapis');
const cookieSession = require('cookie-session');
require('dotenv').config();

const app = express();
app.use(cookieSession({ name: 'session', keys: ['secret'], maxAge: 24 * 60 * 60 * 1000 }));

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// 1. Endpoint para iniciar login Google
app.get('/api/google/login', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.redirect(url);
});

// 2. Callback do Google (redireciona para aqui após login)
app.get('/api/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code');
  const { tokens } = await oauth2Client.getToken(code);
  req.session.tokens = tokens;
  res.redirect('/'); // Redireciona para o frontend
});

// 3. Endpoint para buscar eventos do usuário
app.get('/api/google/events', async (req, res) => {
  if (!req.session.tokens) return res.status(401).send('Not authenticated');
  oauth2Client.setCredentials(req.session.tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const events = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });
  res.json(events.data.items);
});

// 4. Logout
app.get('/api/google/logout', (req, res) => {
  req.session = null;
  res.send('Logged out');
});

// Inicie o servidor
app.listen(3000, () => console.log('Server on http://localhost:3000'));
