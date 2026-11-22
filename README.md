# NeuroGym-front

Aplicación web de **NeuroGym** para socios, personal del gimnasio y profesionales (nutricionistas y deportólogos). Se puede instalar en el celular como app (PWA).

Trabajo Final de Ingeniería en Sistemas Informáticos — Universidad Abierta Interamericana (UAI). Autora: Agustina De Yuliis.

Backend: [NeuroGym-back](https://github.com/DeYuliisAgustina/NeuroGym-back)

**Versión online:** https://neurogym-front.vercel.app — las cuentas de prueba y cómo probar un pago están en el README del backend.

## Tecnologías

React · TypeScript · Vite · React Router · Vitest

## Instalación

Primero hay que tener el backend funcionando (ver su README).

```bash
npm install
cp .env.example .env        # en Windows: copy .env.example .env
npm run dev                 # web en http://localhost:5173
```

## Ingreso

- Socios y profesionales: http://localhost:5173/ingreso
- Personal del gimnasio: http://localhost:5173/admin/ingreso

Las cuentas de prueba están en el README del backend.

## Pruebas

```bash
npm test
```
