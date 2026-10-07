import catalog from '../catalog.json' with { type: 'json' };
import { makeWorker } from '../../lib/qatom-kit.mjs';
import { handlers } from './handlers.mjs';

export default makeWorker(catalog, handlers);
