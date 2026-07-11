import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from '../services/patientService';

/**
 * Sincroniza si el paciente puede ver el historial clínico en su portal.
 * Los doctores pueden desactivarlo por paciente; el menú y rutas deben respetarlo.
 */
export function useClinicalHistoryPortalAccess() {
  const { user, updateUser } = useAuth();

  useEffect(() => {
    if (user?.role !== 'PATIENT') return;

    let cancelled = false;
    (async () => {
      try {
        const profile = await getMyProfile();
        if (cancelled) return;
        const enabled = profile.clinicalHistoryPortalEnabled !== false;
        if (user.clinicalHistoryPortalEnabled !== enabled) {
          updateUser({ ...user, clinicalHistoryPortalEnabled: enabled });
        }
      } catch {
        // Mantener valor de sesión si falla la petición
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.id]);

  const canAccessClinicalHistory =
    user?.role !== 'PATIENT' || user?.clinicalHistoryPortalEnabled !== false;

  return { canAccessClinicalHistory };
}
