// SafePlate — mobile app (Expo / React Native)
// Shares the same Supabase backend as the web platform. Mobile-first surfaces:
// public certificate verification, food-handler sign in / register, and a
// dashboard showing certification status. Payment and the full onboarding
// wizard reuse the web flow for now and are the next mobile build.

import 'react-native-url-polyfill/auto'
import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
const READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = READY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
  : null

const C = { green: '#006600', gold: '#FBAE40', navy: '#003366', ink: '#12241f', muted: '#5b6b64', line: '#e3e7e4', paper: '#fbfcfb', greenPale: '#eef4ee' }
const WEB_APP = 'https://app.safeplate.lagosstate.gov.ng'

export default function App() {
  const [screen, setScreen] = useState('home') // home | verify | auth | dash
  const [session, setSession] = useState(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    if (!READY) { setBooting(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setBooting(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (booting) return <View style={s.center}><ActivityIndicator color={C.green} /></View>

  return (
    <View style={s.app}>
      <StatusBar style="light" />
      <View style={s.header}>
        <Text style={s.brand}>Safe<Text style={{ color: C.gold }}>Plate</Text></Text>
        <Text style={s.brandSub}>Lagos State Ministry of Health</Text>
      </View>
      {screen === 'home' && <Home session={session} go={setScreen} />}
      {screen === 'verify' && <Verify go={setScreen} />}
      {screen === 'auth' && <Auth go={setScreen} onDone={() => setScreen('dash')} />}
      {screen === 'dash' && <Dashboard session={session} go={setScreen} />}
    </View>
  )
}

function Home({ session, go }) {
  return (
    <ScrollView contentContainerStyle={s.body}>
      <Text style={s.h1}>Every plate in Lagos, backed by a verified food handler.</Text>
      <Text style={s.p}>Register, get tested at an accredited lab, and carry a certificate anyone can verify in seconds.</Text>
      {!READY && <View style={s.note}><Text style={s.noteTxt}>Backend not connected. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.</Text></View>}
      <TouchableOpacity style={s.btnGold} onPress={() => go('verify')}><Text style={s.btnGoldTxt}>Verify a certificate</Text></TouchableOpacity>
      {session
        ? <TouchableOpacity style={s.btn} onPress={() => go('dash')}><Text style={s.btnTxt}>Go to my dashboard</Text></TouchableOpacity>
        : <TouchableOpacity style={s.btn} onPress={() => go('auth')}><Text style={s.btnTxt}>Sign in or register</Text></TouchableOpacity>}
      <View style={s.pillars}>
        {['Mandatory biannual testing', 'Accredited laboratories', 'Payments held in escrow', 'Publicly verifiable certificates'].map(t => (
          <View key={t} style={s.pill}><Text style={s.pillTxt}>{t}</Text></View>
        ))}
      </View>
    </ScrollView>
  )
}

function Verify({ go }) {
  const [id, setId] = useState('')
  const [res, setRes] = useState(undefined)
  const [loading, setLoading] = useState(false)
  async function run() {
    const q = id.trim().toUpperCase()
    if (!q) return
    setLoading(true)
    if (!READY) { setRes(null); setLoading(false); return }
    const { data } = await supabase.from('certificates').select('*').eq('safeplate_id', q).limit(1)
    const c = data && data[0]
    if (!c) { setRes(null) }
    else {
      const expired = new Date(c.expiry).getTime() < Date.now()
      setRes({ ...c, status: c.status === 'REVOKED' ? 'REVOKED' : expired ? 'EXPIRED' : 'VALID' })
    }
    setLoading(false)
  }
  const ok = res && res.status === 'VALID'
  return (
    <ScrollView contentContainerStyle={s.body}>
      <Back go={go} />
      <Text style={s.h2}>Verify a certificate</Text>
      <Text style={s.label}>SAFEPLATE ID</Text>
      <TextInput style={s.input} value={id} onChangeText={setId} placeholder="SP-LG-YYYYNNNNN" autoCapitalize="characters" />
      <TouchableOpacity style={s.btnGreen} onPress={run}><Text style={s.btnGreenTxt}>{loading ? 'Checking...' : 'Verify'}</Text></TouchableOpacity>
      {res === null && <View style={[s.result, { backgroundColor: '#fdeeee', borderColor: '#f0c9c9' }]}><Text style={s.badgeBad}>NOT FOUND</Text><Text style={s.p}>No certificate matches that ID.</Text></View>}
      {res && (
        <View style={[s.result, { backgroundColor: ok ? C.greenPale : '#fdeeee', borderColor: ok ? '#bcdcbc' : '#f0c9c9' }]}>
          <Text style={ok ? s.badgeGood : s.badgeBad}>{res.status}</Text>
          <Text style={s.resName}>{res.name}</Text>
          <Text style={s.resLine}>{res.safeplate_id}</Text>
          <Text style={s.resLine}>Panel: {res.panel}</Text>
          <Text style={s.resLine}>Laboratory: {res.lab}</Text>
          <Text style={s.resLine}>Expires: {new Date(res.expiry).toLocaleDateString('en-GB')}</Text>
        </View>
      )}
      <Text style={s.hint}>If a person cannot present a valid certificate, report to LASEPA: 0800-SAFE-PLATE.</Text>
    </ScrollView>
  )
}

function Auth({ go, onDone }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit() {
    setErr(''); setBusy(true)
    if (!READY) { setErr('Backend not connected.'); setBusy(false); return }
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { role: 'food_handler', name } } })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      onDone()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <ScrollView contentContainerStyle={s.body}>
      <Back go={go} />
      <Text style={s.h2}>{mode === 'signup' ? 'Register' : 'Sign in'}</Text>
      {err ? <View style={s.err}><Text style={s.errTxt}>{err}</Text></View> : null}
      {mode === 'signup' && (<><Text style={s.label}>Full name</Text><TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your name" /></>)}
      <Text style={s.label}>Email</Text>
      <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
      <Text style={s.label}>Password</Text>
      <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />
      <TouchableOpacity style={s.btnGreen} onPress={submit} disabled={busy}><Text style={s.btnGreenTxt}>{busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Continue'}</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}><Text style={s.linkC}>{mode === 'signup' ? 'Already registered? Sign in' : 'New here? Create an account'}</Text></TouchableOpacity>
    </ScrollView>
  )
}

function Dashboard({ session, go }) {
  const [cert, setCert] = useState(undefined)
  useEffect(() => {
    (async () => {
      if (!READY || !session) { setCert(null); return }
      const email = session.user.email
      const { data: fh } = await supabase.from('food_handlers').select('safeplate_id').eq('email', email).limit(1)
      const sid = fh && fh[0] && fh[0].safeplate_id
      if (!sid) { setCert(null); return }
      const { data } = await supabase.from('certificates').select('*').eq('safeplate_id', sid).limit(1)
      setCert((data && data[0]) || null)
    })()
  }, [session])
  const name = session && session.user && (session.user.user_metadata?.name || session.user.email)
  return (
    <ScrollView contentContainerStyle={s.body}>
      <Text style={s.h2}>Welcome, {name}</Text>
      {cert === undefined && <ActivityIndicator color={C.green} />}
      {cert === null && (
        <View style={s.card}>
          <Text style={s.p}>No certificate yet. Complete registration and payment to get certified.</Text>
          <TouchableOpacity style={s.btnGold} onPress={() => Linking.openURL(WEB_APP)}><Text style={s.btnGoldTxt}>Continue on the web app</Text></TouchableOpacity>
        </View>
      )}
      {cert && (
        <View style={[s.card, { borderColor: C.green, borderWidth: 2 }]}>
          <Text style={s.resName}>{cert.name}</Text>
          <Text style={s.resLine}>{cert.safeplate_id}</Text>
          <Text style={s.resLine}>Status: {cert.status}</Text>
          <Text style={s.resLine}>Expires: {new Date(cert.expiry).toLocaleDateString('en-GB')}</Text>
        </View>
      )}
      <TouchableOpacity style={s.btn} onPress={() => go('verify')}><Text style={s.btnTxt}>Verify a certificate</Text></TouchableOpacity>
      <TouchableOpacity style={s.btn} onPress={async () => { if (READY) await supabase.auth.signOut(); go('home') }}><Text style={s.btnTxt}>Sign out</Text></TouchableOpacity>
    </ScrollView>
  )
}

function Back({ go }) {
  return <TouchableOpacity onPress={() => go('home')}><Text style={s.back}>← Back</Text></TouchableOpacity>
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  header: { backgroundColor: C.green, paddingTop: 54, paddingBottom: 16, paddingHorizontal: 22 },
  brand: { color: '#fff', fontSize: 24, fontWeight: '800' },
  brandSub: { color: '#d7e8d7', fontSize: 12, marginTop: 2 },
  body: { padding: 22, paddingBottom: 60 },
  h1: { fontSize: 26, fontWeight: '800', color: C.ink, lineHeight: 32, marginBottom: 10 },
  h2: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 14 },
  p: { fontSize: 15, color: C.muted, lineHeight: 22, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 6, marginTop: 6 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 13, fontSize: 16, backgroundColor: '#fff', marginBottom: 12 },
  btn: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 10, backgroundColor: '#fff' },
  btnTxt: { fontWeight: '700', color: C.ink, fontSize: 15 },
  btnGreen: { backgroundColor: C.green, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 6 },
  btnGreenTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnGold: { backgroundColor: C.gold, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 6 },
  btnGoldTxt: { color: '#3a2600', fontWeight: '700', fontSize: 15 },
  pillars: { marginTop: 22 },
  pill: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 13, marginBottom: 8 },
  pillTxt: { color: C.ink, fontWeight: '600' },
  result: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 16 },
  badgeGood: { alignSelf: 'flex-start', backgroundColor: C.green, color: '#fff', fontWeight: '800', fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  badgeBad: { alignSelf: 'flex-start', backgroundColor: '#b3261e', color: '#fff', fontWeight: '800', fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  resName: { fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 10 },
  resLine: { fontSize: 14, color: C.muted, marginTop: 3 },
  hint: { fontSize: 12, color: C.muted, marginTop: 16 },
  note: { backgroundColor: '#fdf3e0', borderWidth: 1, borderColor: '#f2dcae', borderRadius: 10, padding: 12, marginBottom: 14 },
  noteTxt: { color: '#8a5a00', fontSize: 13 },
  err: { backgroundColor: '#fdeeee', borderWidth: 1, borderColor: '#f0c9c9', borderRadius: 10, padding: 11, marginBottom: 12 },
  errTxt: { color: '#b3261e', fontSize: 13 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 18, marginBottom: 12 },
  back: { color: C.green, fontWeight: '700', marginBottom: 10, fontSize: 15 },
  linkC: { color: C.green, fontWeight: '700', textAlign: 'center', marginTop: 14 }
})
