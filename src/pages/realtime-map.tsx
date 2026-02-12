'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import { DirectionsRenderer, GoogleMap, Marker, useLoadScript } from '@react-google-maps/api'
import Spinner from 'react-bootstrap/Spinner'
import { encrypt } from '@/utils/helpers'

interface Point {
  lat: number
  lng: number
}

const mapStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
}

const RealtimeMap = () => {
  const router = useRouter()
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GoogleMapsApiKey) as string,
  })

  const [caregiver, setCaregiver] = useState<Point | null>(null)
  const [dependent, setDependent] = useState<Point | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [nav, setNav] = useState({
    instruction: 'กำลังคำนวณเส้นทาง',
    distance: '-',
    duration: '-',
  })
  const [ctx, setCtx] = useState({ usersId: 0, takecareId: 0, safezoneId: 0 })

  const center = useMemo(() => dependent || caregiver || { lat: 13.8900, lng: 100.5993 }, [dependent, caregiver])

  useEffect(() => {
    const loadContext = async () => {
      try {
        const auToken = router.query.auToken as string
        const idSafezone = Number(router.query.idsafezone || 0)
        if (!auToken) return

        const userRes = await axios.get(`${process.env.WEB_DOMAIN}/api/user/getUser/${auToken}`)
        const user = userRes.data?.data
        if (!user) return

        const encodedUsersId = encrypt(user.users_id.toString())
        const takecareRes = await axios.get(`${process.env.WEB_DOMAIN}/api/user/getUserTakecareperson/${encodedUsersId}`)
        const takecare = takecareRes.data?.data
        if (!takecare) return

        const safezoneRes = await axios.get(`${process.env.WEB_DOMAIN}/api/setting/getSafezone?takecare_id=${takecare.takecare_id}&users_id=${user.users_id}&id=${idSafezone || ''}`)
        const safezone = safezoneRes.data?.data
        if (safezone) {
          setCaregiver({ lat: Number(safezone.safez_latitude), lng: Number(safezone.safez_longitude) })
          setCtx({ usersId: Number(user.users_id), takecareId: Number(takecare.takecare_id), safezoneId: Number(safezone.safezone_id || idSafezone || 0) })
        }
      } catch (error) {
        console.log('loadContext error', error)
      }
    }
    loadContext()
  }, [router.query.auToken, router.query.idsafezone])

  useEffect(() => {
    if (!ctx.usersId || !ctx.takecareId) return

    const fetchDependent = async () => {
      try {
        const res = await axios.get(`${process.env.WEB_DOMAIN}/api/location/getLocation?takecare_id=${ctx.takecareId}&users_id=${ctx.usersId}&safezone_id=${ctx.safezoneId}`)
        const loc = res.data?.data
        if (loc) {
          setDependent({ lat: Number(loc.locat_latitude), lng: Number(loc.locat_longitude) })
        }
      } catch (error) {
        console.log('fetchDependent error', error)
      }
    }

    fetchDependent()
    const t = setInterval(fetchDependent, 3000)
    return () => clearInterval(t)
  }, [ctx])

  useEffect(() => {
    if (!isLoaded || !caregiver || !dependent) return

    const service = new window.google.maps.DirectionsService()
    service.route(
      {
        origin: caregiver,
        destination: dependent,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirections(result)
          const leg = result.routes?.[0]?.legs?.[0]
          const firstStep = leg?.steps?.[0]
          setNav({
            instruction: (firstStep?.instructions || 'ไปยังปลายทาง').replace(/<[^>]+>/g, ''),
            distance: leg?.distance?.text || '-',
            duration: leg?.duration?.text || '-',
          })
        } else {
          setDirections(null)
        }
      }
    )
  }, [isLoaded, caregiver, dependent])

  if (!isLoaded) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <GoogleMap
        mapContainerStyle={mapStyle}
        center={center}
        zoom={18}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
        }}
      >
        {directions ? (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: { strokeColor: '#2F6FED', strokeWeight: 7, strokeOpacity: 0.95 },
            }}
          />
        ) : null}
        {dependent ? (
          <Marker
            position={dependent}
            icon={{ url: 'https://maps.google.com/mapfiles/kml/pal2/icon6.png', scaledSize: new window.google.maps.Size(42, 42) }}
          />
        ) : null}
        {caregiver ? (
          <Marker
            position={caregiver}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: '#2F6FED',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            }}
          />
        ) : null}
      </GoogleMap>

      <div style={{ position: 'fixed', top: 12, left: 12, right: 12, zIndex: 20, background: '#0f5f3b', color: '#fff', borderRadius: 14, padding: '12px 14px' }}>
        <div style={{ fontSize: 30, lineHeight: 1 }}>↑</div>
        <div style={{ marginTop: -32, marginLeft: 38 }}>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{nav.instruction}</div>
          <div style={{ fontSize: 14, opacity: 0.9 }}>เส้นทางเรียลไทม์</div>
        </div>
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20, background: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '14px 16px 22px' }}>
        <div style={{ width: 64, height: 5, borderRadius: 8, background: '#d1d5db', margin: '0 auto 10px' }} />
        <div style={{ fontSize: 38, lineHeight: 1, color: '#0f5f3b', fontWeight: 800 }}>{nav.duration}</div>
        <div style={{ marginTop: 4, fontSize: 24, color: '#334155', fontWeight: 600 }}>{nav.distance}</div>
        <button
          onClick={() => window.history.back()}
          style={{ position: 'absolute', right: 16, bottom: 16, border: 'none', background: '#e11d2e', color: '#fff', borderRadius: 999, padding: '10px 24px', fontSize: 28, fontWeight: 700 }}
        >
          ออก
        </button>
      </div>
    </div>
  )
}

export default RealtimeMap
