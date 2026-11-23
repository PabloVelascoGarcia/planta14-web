import { randomBytes } from 'node:crypto';

// Marca interna de las peticiones que llegan a la API de Payload por el puente del panel municipal (/api/panel/api).
// Es un secreto aleatorio del proceso (nunca sale del servidor): el puente lo pone en la petición interna que construye
// desde cero, y una petición de fuera no puede conocerlo. Así la API de Payload rechaza a las cuentas municipales salvo
// por el puente, y solo el puente o «Entrar» del panel pueden iniciar su sesión.
const KEY = Symbol.for('planta14.panelBridgeSecret');
const store = globalThis as unknown as Record<symbol, string | undefined>;
export const BRIDGE_HEADER = 'x-planta14-panel-bridge';
export function bridgeSecret() {
  return (store[KEY] ??= randomBytes(32).toString('hex'));
}
export function fromBridge(headers?: Headers | null) {
  const value = headers?.get?.(BRIDGE_HEADER);
  return Boolean(value) && value === bridgeSecret();
}
