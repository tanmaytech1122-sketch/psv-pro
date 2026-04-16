import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// Unwrap { ok, result } envelope
api.interceptors.response.use(
  r => r.data,
  e => Promise.reject(e.response?.data || { error: e.message })
)

// ── Sizing ────────────────────────────────────────────────────────
export const size = {
  gas:         (params) => api.post('/size/gas',         params).then(d => d.result),
  steam:       (params) => api.post('/size/steam',       params).then(d => d.result),
  liquid:      (params) => api.post('/size/liquid',      params).then(d => d.result),
  twophase:    (params) => api.post('/size/twophase',    params).then(d => d.result),
  fire:        (params) => api.post('/size/fire',        params).then(d => d.result),
  thermal:     (params) => api.post('/size/thermal',     params).then(d => d.result),
  tuberupture: (params) => api.post('/size/tuberupture', params).then(d => d.result),
  blowdown:    (params) => api.post('/size/blowdown',    params).then(d => d.result),
  blowdownAutosize:(p)  => api.post('/size/blowdown/autosize', p).then(d => d.result),
  api2000:     (params) => api.post('/size/api2000',     params).then(d => d.result),
  reaction:    (params) => api.post('/size/reaction',    params).then(d => d.result),
  orifice:     (A)      => api.get('/size/orifice',  { params: { A } }).then(d => d.result),
  corrections: (params) => api.get('/size/corrections', { params }).then(d => d.result),
  eos:         (P,T,fluid) => api.get('/size/eos', { params: {P,T,fluid} }).then(d => d.result),
  validate:    ()       => api.get('/size/validate').then(d => d.result),
  
  // NEW: AI Query endpoint
  aiQuery:     (query)  => api.post('/size/ai-query', { query }).then(d => d.result),
}

// ── Projects ──────────────────────────────────────────────────────
export const projects = {
  list:   ()     => api.get('/projects').then(d => d.result),
  get:    (id)   => api.get(`/projects/${id}`).then(d => d.result),
  create: (body) => api.post('/projects', body).then(d => d.result),
  update: (id,b) => api.put(`/projects/${id}`, b).then(d => d.result),
  delete: (id)   => api.delete(`/projects/${id}`).then(d => d),
}

// ── Cases ─────────────────────────────────────────────────────────
export const cases = {
  list:   (pid)     => api.get(`/projects/${pid}/cases`).then(d => d.result),
  get:    (pid,id)  => api.get(`/projects/${pid}/cases/${id}`).then(d => d.result),
  create: (pid,body)=> api.post(`/projects/${pid}/cases`, body).then(d => d.result),
  update: (pid,id,b)=> api.put(`/projects/${pid}/cases/${id}`, b).then(d => d.result),
  delete: (pid,id)  => api.delete(`/projects/${pid}/cases/${id}`).then(d => d),
}

export default api