import { Hono } from 'hono';

// D1 helper: expects env.DB to be bound in wrangler.toml
async function getUserByEmail(env, email) {
  const stmt = env.DB.prepare('SELECT * FROM User WHERE email = ?');
  const result = await stmt.bind(email).first();
  return result;
}

const app = new Hono();

app.get('/', (c) => c.text('AdvisorAgent Backend API is running'));

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }
  const user = await getUserByEmail(c.env, email);
  if (!user || user.password !== password) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  // TODO: Issue JWT and return user info
  return c.json({ message: 'Login successful', user: { id: user.id, email: user.email } });
});

export default app;
