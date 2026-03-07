# Pase de lista Cadés

Sistema de asistencia invertido desarrollado con Next.js, Firebase y Tailwind CSS.

## Características Principales

- **Asistencia con Código QR (Modelo Invertido)**: En lugar de que los diris escaneen un código QR estático proyectado o impreso, la app genera un código QR criptográfico, único y caducable en los teléfonos de los diris. Los coordinadores (coordis y asesores) utilizan el escáner web incorporado en su dashboard para escanear a cada uno a medida que llegan. 
- **Roles de Usuario**:
  - `diri`: Los participantes. Tienen un panel donde acceden a su código QR y a su historial de asistencias, visualizando además su porcentaje local de rendimiento que usa código de color verde, amarillo o rojo como retroalimentación real.
  - `coordi`: Administradores. Tienen el control total para habilitar las asambleas (sesiones), abrir la cámara (modo escáner masivo), corregir asistencias erróneas manualmente (anular faltas/retardos), y modificar los roles sistémicos de la plataforma.
  - `asesor`: Staff u observadores. Comparten el mismo tablero visual que los coordis para monitorear tendencias, ver nóminas y utilizar el escáner, pero no pueden iniciar nuevas *Asambleas/Juntas* ni modificar campos en la base de datos o cuentas de terceros.
- **Sistema de Retardos (Late Mode)**: En la pestaña de escriptación, el Coordi puede activar una penalización en donde todas las llegadas registradas a partir de una cierta franja de tiempo figurarán como *Retardos* y no como *Asistencias*. Esto afectará el puntaje general del diri.
- **Progreso Visual y Recompensas**: Según el desempeño (*attendancePercentage*) de un `diri`, el dashboard ajusta su diseño de texto e interfaz. Debajo del 80% genera señales de alerta (Acentos Rojos).

## Tech Stack

- **Framework**: [Next.js 14+ (App Router)](https://nextjs.org/)
- **Cámara y Lector QR**: `@yudiel/react-qr-scanner` y `react-qr-code`
- **Animaciones**: `framer-motion` + `lucide-react` para iconos SVG.
- **Styling**: Tailwind CSS
- **BaaS (Backend, Base de Datos, Autenticación)**: Firebase (Firestore y Auth)
- **Deployment**: Vercel

## Instrucciones de Desarrollo

Para ejecutar este proyecto en tu entorno local:

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Variables de Entorno**:
   Necesitarás configurar tus variables de Firebase en un archivo `.env.local`:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_dominio.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_bucket.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tus_ids
   NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id
   ```

3. **Iniciar el Servidor**:
   ```bash
   npm run dev
   ```

Abre [http://localhost:3000](http://localhost:3000) con tu navegador para ver la pestaña inicial.

## Contacto & Créditos
Esta aplicación fue personalizada estéticamente para integrar colores de marca y optimizar la fluidez directiva de la comunidad Cadés.
