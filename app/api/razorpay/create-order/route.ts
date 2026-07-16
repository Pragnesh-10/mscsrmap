import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'

export async function POST(req: NextRequest) {
  const { amount, currency = 'INR', receipt, notes } = await req.json()

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json(
      { error: 'Razorpay is not configured. Contact the administrator.' },
      { status: 500 }
    )
  }

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  })

  try {
    const order = await razorpay.orders.create({
      amount: amount, // already in paise
      currency,
      receipt,
      notes,
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    })
  } catch (error: any) {
    console.error('Razorpay order creation failed:', error)
    return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 })
  }
}
