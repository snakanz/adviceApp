import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper, Avatar, Stack, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import { api } from '../services/api';

const SYSTEM_PROMPT = 'You are a helpful assistant for financial advisors using Advicly.';

export default function AskAdvicly() {
  const [messages, setMessages] = useState([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'assistant', content: 'Hi! I am Advicly AI. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const feedRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom on new message
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      // Call OpenAI API via backend
      const res = await api.request('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...newMessages.filter(m => m.role !== 'system')
          ]
        })
      });
      setMessages([...newMessages, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, there was an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#F8FAFC' }}>
      <Box sx={{ px: 4, py: 3, borderBottom: '1px solid #E5E5E5', bgcolor: '#fff' }}>
        <Stack direction="row" alignItems="center" gap={2}>
          <AutoAwesomeIcon sx={{ color: '#007AFF', fontSize: 32 }} />
          <Typography variant="h4" fontWeight={700} color="#1E1E1E">Ask Advicly</Typography>
        </Stack>
      </Box>
      <Box ref={feedRef} sx={{ flex: 1, overflowY: 'auto', px: 0, py: 4, maxWidth: 700, mx: 'auto', width: '100%' }}>
        {messages.filter(m => m.role !== 'system').map((msg, idx) => (
          <Box key={idx} sx={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end', mb: 3 }}>
            <Avatar sx={{ bgcolor: msg.role === 'user' ? '#007AFF' : '#F0F0F0', color: msg.role === 'user' ? '#fff' : '#222', ml: msg.role === 'user' ? 2 : 0, mr: msg.role === 'assistant' ? 2 : 0 }}>
              {msg.role === 'user' ? 'You' : <AutoAwesomeIcon sx={{ color: '#007AFF' }} />}
            </Avatar>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: msg.role === 'user' ? '#E6F0FF' : '#fff', color: '#222', maxWidth: 500, minWidth: 80, ml: msg.role === 'assistant' ? 1 : 0, mr: msg.role === 'user' ? 1 : 0 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>{msg.content}</Typography>
            </Paper>
          </Box>
        ))}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <CircularProgress size={20} sx={{ mr: 2 }} />
            <Typography variant="body2" color="#888">Advicly is thinking...</Typography>
          </Box>
        )}
      </Box>
      <Box sx={{ px: 4, py: 3, borderTop: '1px solid #E5E5E5', bgcolor: '#fff', display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField
          fullWidth
          multiline
          minRows={1}
          maxRows={4}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your question..."
          sx={{ borderRadius: 2, bgcolor: '#F8FAFC' }}
        />
        <Button
          variant="contained"
          color="primary"
          endIcon={<SendIcon />}
          onClick={handleSend}
          disabled={loading || !input.trim()}
          sx={{ borderRadius: 2, fontWeight: 600, px: 3, py: 1.5 }}
        >
          Send
        </Button>
      </Box>
    </Box>
  );
} 