'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import {
  Circle,
  DirectionsRenderer,
  GoogleMap,
  Marker,
  Polyline,
  useLoadScript,
} from '@react-google-maps/api'
import Spinner from 'react-bootstrap/Spinner'
import { encrypt } from '@/utils/helpers'

interface Point {
  lat: number
  lng: number
}

interface SafezoneInfo {
  lat: number
  lng: number
  radiusLv1: number
  radiusLv2: number
  safezoneId: number
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

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [caregiver, setCaregiver] = useState<Point | null>(null)
  const [dependent, setDependent] = useState<Point | null>(null)
  const [trail, setTrail] = useState<Point[]>([])
  const [safezone, setSafezone] = useState<SafezoneInfo | null>(null)
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null)
  const [nav, setNav] = useState({
    instruction: 'Calculating route',
    distance: '-',
    duration: '-',
  })
  const [ctx, setCtx] = useState({ usersId: 0, takecareId: 0, safezoneId: 0 })

  const center = useMemo(() => dependent || caregiver || { lat: 13.8900, lng: 100.5993 }, [dependent, caregiver])
  const googleNavUrl = useMemo(() => {
    if (!dependent) return ''
    const destination = `${dependent.lat},${dependent.lng}`
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving&dir_action=navigate`
  }, [dependent])

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

        const safezoneRes = await axios.get(
          `${process.env.WEB_DOMAIN}/api/setting/getSafezone?takecare_id=${takecare.takecare_id}&users_id=${user.users_id}&id=${idSafezone || ''}`
        )
        const sz = safezoneRes.data?.data
        if (sz) {
          const cg = {
            lat: Number(sz.safez_latitude),
            lng: Number(sz.safez_longitude),
          }
          setCaregiver(cg)
          setSafezone({
            ...cg,
            radiusLv1: Number(sz.safez_radiuslv1 || 0),
            radiusLv2: Number(sz.safez_radiuslv2 || 0),
            safezoneId: Number(sz.safezone_id || idSafezone || 0),
          })
          setCtx({
            usersId: Number(user.users_id),
            takecareId: Number(takecare.takecare_id),
            safezoneId: Number(sz.safezone_id || idSafezone || 0),
          })
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
        const res = await axios.get(
          `${process.env.WEB_DOMAIN}/api/location/getLocation?takecare_id=${ctx.takecareId}&users_id=${ctx.usersId}&safezone_id=${ctx.safezoneId}`
        )
        const loc = res.data?.data
        if (!loc) return

        const next = {
          lat: Number(loc.locat_latitude),
          lng: Number(loc.locat_longitude),
        }
        setDependent(next)
        setTrail((prev) => {
          const last = prev[prev.length - 1]
          if (last && last.lat === next.lat && last.lng === next.lng) return prev
          const merged = [...prev, next]
          return merged.slice(-30)
        })
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
    const updateNav = (result: google.maps.DirectionsResult) => {
      const leg = result.routes?.[0]?.legs?.[0]
      const firstStep = leg?.steps?.[0]
      setNav({
        instruction: (firstStep?.instructions || 'Proceed to destination').replace(/<[^>]+>/g, ''),
        distance: leg?.distance?.text || '-',
        duration: leg?.duration?.text || '-',
      })
    }
    service.route(
      {
        origin: caregiver,
        destination: dependent,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirections(result)
          updateNav(result)
          return
        }
        service.route(
          {
            origin: caregiver,
            destination: dependent,
            travelMode: window.google.maps.TravelMode.WALKING,
          },
          (result2, status2) => {
            if (status2 === window.google.maps.DirectionsStatus.OK && result2) {
              setDirections(result2)
              updateNav(result2)
            } else {
              setDirections(null)
              setNav({ instruction: 'No road route found', distance: '-', duration: '-' })
            }
          }
        )
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
        onLoad={(m) => setMap(m)}
        mapContainerStyle={mapStyle}
        center={center}
        options={{
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          gestureHandling: 'greedy',
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

        {trail.length > 1 ? (
          <Polyline
            path={trail}
            options={{ strokeColor: '#ef4444', strokeOpacity: 0.55, strokeWeight: 4 }}
          />
        ) : null}

        {safezone ? (
          <>
            <Circle
              center={{ lat: safezone.lat, lng: safezone.lng }}
              radius={safezone.radiusLv1}
              options={{ fillColor: '#F2BE22', strokeColor: '#F2BE22', fillOpacity: 0.2 }}
            />
            <Circle
              center={{ lat: safezone.lat, lng: safezone.lng }}
              radius={safezone.radiusLv2}
              options={{ fillColor: '#F24C3D', strokeColor: '#F24C3D', fillOpacity: 0.1 }}
            />
          </>
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

      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          right: 12,
          zIndex: 20,
          background: '#0f5f3b',
          color: '#fff',
          borderRadius: 14,
          padding: '10px 14px',
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 700 }}>{nav.instruction}</div>
        <div style={{ fontSize: 14, opacity: 0.9 }}>{`${nav.duration} • ${nav.distance}`}</div>
      </div>

      <div
        style={{
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: 16,
          zIndex: 20,
          display: 'flex',
          justifyContent: 'flex-start',
          gap: 12,
        }}
      >
        {googleNavUrl ? (
          <button
            onClick={() => {
              window.location.href = googleNavUrl
            }}
            style={{
              border: '1px solid #0f5f3b',
              background: '#ffffff',
              color: '#0f5f3b',
              borderRadius: 999,
              padding: '10px 18px',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            Start navigation
          </button>
        ) : null}
      </div>
    </div>
  )
}
export default RealtimeMap
