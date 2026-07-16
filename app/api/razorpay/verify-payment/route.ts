import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(req: NextRequest) {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    event_id,
    payer_email,
    amount,
    charge_type,
  } = await req.json()

  if (!process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: 'Razorpay not configured' }, { status: 500 })
  }

  // HMAC-SHA256 verification
  const body = razorpay_order_id + '|' + razorpay_payment_id
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex')

  const isValid = expectedSignature === razorpay_signature

  if (!isValid) {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
  }

  // Record the verified payment in Supabase
  const supabase = createAdminClient()
  const { error } = await supabase.from('payments').insert({
    event_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    amount,
    charge_type,
    payer_email,
    status: 'paid',
    verified_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Failed to record payment in database:', error)
    // Still return verified=true since payment was genuine, but log the error
  }

  return NextResponse.json({ verified: true, payment_id: razorpay_payment_id })
}
