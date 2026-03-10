import React, { useState } from 'react';
import { Box, Typography, Button, Card, CardContent, CardActions, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const CalendarConnect: React.FC = () => {
  const navigate = useNavigate();
  const [showGoogleDialog, setShowGoogleDialog] = useState(false);
  const [showOutlookDialog, setShowOutlookDialog] = useState(false);

  const handleGoogleConnect = async () => {
    try {
      const response = await api.get('/calendar/connect/google/url');
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Error al obtener URL de autorización de Google:', error);
    }
  };

  const handleOutlookConnect = async () => {
    try {
      const response = await api.get('/calendar/connect/outlook/url');
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Error al obtener URL de autorización de Outlook:', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Conectar Calendario
      </Typography>

      <Box sx={{ display: 'flex', gap: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Google Calendar
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Conecta tu calendario de Google para sincronizar tus citas y disponibilidad.
              Podrás ver tus eventos existentes y gestionar tu agenda desde Qlinexa360.
            </Typography>
          </CardContent>
          <CardActions>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setShowGoogleDialog(true)}
            >
              Conectar Google Calendar
            </Button>
          </CardActions>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h5" sx={{ mb: 2 }}>
              Outlook Calendar
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Conecta tu calendario de Outlook para sincronizar tus citas y disponibilidad.
              Podrás ver tus eventos existentes y gestionar tu agenda desde Qlinexa360.
            </Typography>
          </CardContent>
          <CardActions>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setShowOutlookDialog(true)}
            >
              Conectar Outlook Calendar
            </Button>
          </CardActions>
        </Card>
      </Box>

      <Dialog open={showGoogleDialog} onClose={() => setShowGoogleDialog(false)}>
        <DialogTitle>Conectar Google Calendar</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Al conectar tu calendario de Google, Qlinexa360 podrá:
          </Typography>
          <ul>
            <li>Ver tus eventos existentes</li>
            <li>Crear nuevas citas</li>
            <li>Actualizar eventos existentes</li>
            <li>Gestionar tu disponibilidad</li>
          </ul>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Solo tendremos acceso a tu calendario principal y no compartiremos tus datos con terceros.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGoogleDialog(false)}>Cancelar</Button>
          <Button onClick={handleGoogleConnect} variant="contained" color="primary">
            Continuar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showOutlookDialog} onClose={() => setShowOutlookDialog(false)}>
        <DialogTitle>Conectar Outlook Calendar</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Al conectar tu calendario de Outlook, Qlinexa360 podrá:
          </Typography>
          <ul>
            <li>Ver tus eventos existentes</li>
            <li>Crear nuevas citas</li>
            <li>Actualizar eventos existentes</li>
            <li>Gestionar tu disponibilidad</li>
          </ul>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Solo tendremos acceso a tu calendario principal y no compartiremos tus datos con terceros.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOutlookDialog(false)}>Cancelar</Button>
          <Button onClick={handleOutlookConnect} variant="contained" color="primary">
            Continuar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalendarConnect; 