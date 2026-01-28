'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { useData } from '@/lib/DataContext'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  isWithinInterval,
  parseISO
} from 'date-fns'
import { ChevronLeft, ChevronRight, CheckCircle2, Clock, Target, CalendarDays, Zap } from 'lucide-react'
import { formatTimeTo12h } from '@/lib/utils'
import clsx from 'clsx'

// Motivational quotes
const quotes = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Ang taong hindi marunong lumingon sa pinanggalingan ay hindi makararating sa paroroonan.", author: "Jose Rizal" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Kung gusto, may paraan. Kung ayaw, may dahilan.", author: "Filipino Proverb" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "Walang himala! Ang himala ay nasa puso ng tao!", author: "Elsa (Himala)" },
  { text: "Every accomplishment starts with the decision to try.", author: "John F. Kennedy" },
  { text: "Kapag may tiyaga, may nilaga.", author: "Filipino Proverb" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
]

// Fox SVG Component
function FoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 8L16 24L8 16V32L16 40L24 48H40L48 40L56 32V16L48 24L32 8Z" fill="#FF9F1C" />
      <path d="M16 24L8 16V32L16 40L24 32L16 24Z" fill="#F68E09" />
      <path d="M48 24L56 16V32L48 40L40 32L48 24Z" fill="#F68E09" />
      <path d="M24 32L32 40L40 32L32 24L24 32Z" fill="#FFFFFF" />
      <circle cx="24" cy="28" r="3" fill="#2D3436" />
      <circle cx="40" cy="28" r="3" fill="#2D3436" />
      <path d="M28 36L32 40L36 36" stroke="#2D3436" strokeWidth="2" strokeLinecap="round" />
      <circle cx="25" cy="27" r="1" fill="#FFFFFF" />
      <circle cx="41" cy="27" r="1" fill="#FFFFFF" />
    </svg>
  )
}

// Peso Icon Component
function PesoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 4V20M6 12H14C16.2091 12 18 10.2091 18 8C18 5.79086 16.2091 4 14 4H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 8H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 10H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function Home() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [dailyQuote, setDailyQuote] = useState(quotes[0])

  // Use global data context instead of local state
  const { plans, goals, revenues, cards, isLoading } = useData()

  // Select random quote only on client side to avoid hydration mismatch
  useEffect(() => {
    setDailyQuote(quotes[Math.floor(Math.random() * quotes.length)])
  }, [])

  // Small calendar data
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Get greeting based on time and day
  const getGreeting = () => {
    const hour = new Date().getHours()
    const dayOfWeek = getDay(new Date())
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    let timeGreeting = ''
    if (hour < 12) timeGreeting = 'Good Morning'
    else if (hour < 17) timeGreeting = 'Good Afternoon'
    else timeGreeting = 'Good Evening'

    let dayMessage = ''
    switch (dayOfWeek) {
      case 0: // Sunday
        dayMessage = "It's Church Day"
        break
      case 1: // Monday
        dayMessage = "Start the week strong"
        break
      case 2: // Tuesday
        dayMessage = "Keep the momentum going"
        break
      case 3: // Wednesday
        dayMessage = "Midweek hustle"
        break
      case 4: // Thursday
        dayMessage = "Almost there"
        break
      case 5: // Friday
        dayMessage = "Finish strong this week"
        break
      case 6: // Saturday
        dayMessage = "Happy Saturday"
        break
    }

    return { timeGreeting, dayMessage, dayName: dayNames[dayOfWeek] }
  }

  const greeting = getGreeting()

  // Get today's plans
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todaysPlans = plans.filter(plan => {
    if (plan.date === todayStr) return true
    if (plan.hasDueDate && plan.dueDate) {
      return plan.date <= todayStr && plan.dueDate >= todayStr
    }
    return false
  })

  // Get first task today (prioritize ones with time slots)
  const getFirstTask = () => {
    // First, check for tasks with time slots and get the earliest one
    const tasksWithTime = todaysPlans.filter(p => p.timeSlots && p.timeSlots.length > 0 && !p.completed)
    if (tasksWithTime.length > 0) {
      const allTimeSlots = tasksWithTime.flatMap(plan =>
        (plan.timeSlots || []).map(slot => ({
          time: slot.time,
          description: slot.description,
          planTitle: plan.title,
          plan
        }))
      ).sort((a, b) => a.time.localeCompare(b.time))

      if (allTimeSlots.length > 0) {
        return allTimeSlots[0]
      }
    }

    // Otherwise, return first incomplete task
    const firstIncomplete = todaysPlans.find(p => !p.completed)
    if (firstIncomplete) {
      return {
        time: null,
        description: null,
        planTitle: firstIncomplete.title,
        plan: firstIncomplete
      }
    }

    return null
  }

  const firstTask = getFirstTask()

  // Get plans with time slots for today's schedule
  const todaysSchedule = todaysPlans
    .filter(plan => plan.timeSlots && plan.timeSlots.length > 0)
    .flatMap(plan =>
      (plan.timeSlots || []).map(slot => ({
        ...slot,
        planTitle: plan.title,
        planId: plan.id,
        completed: plan.completed
      }))
    )
    .sort((a, b) => a.time.localeCompare(b.time))

  // Productivity stats
  const completedToday = todaysPlans.filter(p => p.completed).length
  const totalToday = todaysPlans.length

  // Due Today: Count BOTH plans and cards due today
  // Plans due today (not completed)
  const plansDueToday = plans.filter(plan => {
    if (plan.completed) return false
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    // Check if plan date is today
    if (plan.date === todayStr) return true
    // Check if plan has a due date that's today
    if (plan.hasDueDate && plan.dueDate === todayStr) return true
    return false
  }).length

  // Cards due today (not completed)
  const cardsDueToday = cards.filter(card => {
    if (card.status === 'completed') return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (card.endDate) {
      try {
        if (isSameDay(parseISO(card.endDate), today)) return true
      } catch (_e) { /* ignore */ }
    }
    if (card.startDate) {
      try {
        if (isSameDay(parseISO(card.startDate), today)) return true
      } catch (_e) { /* ignore */ }
    }
    return false
  }).length

  const dueTodayCards = plansDueToday + cardsDueToday

  // Upcoming: Count BOTH plans and cards for tomorrow onwards
  // Upcoming plans (not completed)
  const upcomingPlans = plans.filter(plan => {
    if (plan.completed) return false
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd')
    // Check if plan date is tomorrow or later
    if (plan.date >= tomorrowStr) return true
    // Check if plan has a due date that's tomorrow or later
    if (plan.hasDueDate && plan.dueDate && plan.dueDate >= tomorrowStr) return true
    return false
  }).length

  // Upcoming cards (not completed)
  const upcomingCardsCount = cards.filter(card => {
    if (card.status === 'completed') return false
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    if (card.endDate) {
      try {
        if (parseISO(card.endDate) >= tomorrow) return true
      } catch (_e) { /* ignore */ }
    }
    if (card.startDate) {
      try {
        if (parseISO(card.startDate) >= tomorrow) return true
      } catch (_e) { /* ignore */ }
    }
    return false
  }).length

  const upcomingCards = upcomingPlans + upcomingCardsCount

  // Active goals count (from Goals section)
  const activeGoals = goals.length

  // This month's revenue (from Revenue section)
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)

  const thisMonthRevenue = revenues
    .filter(r => {
      const date = parseISO(r.dateCompleted)
      return isWithinInterval(date, { start: thisMonthStart, end: thisMonthEnd })
    })
    .reduce((sum, r) => sum + r.price, 0)

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col">
      {/* Main Content */}
      <div className="flex-1">
        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column - Greeting & Cards */}
          <div className="lg:col-span-2 space-y-6">

            {/* Greeting - Bigger */}
            <div className="flex items-center gap-5">
              <FoxIcon className="w-20 h-20 flex-shrink-0" />
              <div>
                <h1 className={clsx(
                  "text-3xl md:text-4xl lg:text-5xl font-bold",
                  isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                )}>
                  {greeting.timeGreeting}, Stun!
                </h1>
                <p className={clsx(
                  "text-lg md:text-xl mt-1",
                  isDark ? "text-[#FF9F1C]" : "text-[#636E72]"
                )}>
                  {greeting.dayMessage} — {greeting.dayName}
                </p>
              </div>
            </div>

            {/* Summary Cards - 2 per row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Tasks Due Today */}
              <div className={clsx(
                "p-5 rounded-2xl shadow-sm border card-hover transition-colors",
                isDark
                  ? "bg-[#1A1A1A] border-[#2A2A2A]"
                  : "bg-white border-[#EFEEEE]"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isDark ? "bg-[#FF9F1C]/20" : "bg-[#FFF2E0]"
                  )}>
                    <CalendarDays className="w-5 h-5 text-[#FF9F1C]" />
                  </div>
                  <p className={clsx(
                    "text-sm font-medium",
                    isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                  )}>Due Today</p>
                </div>
                <p className={clsx(
                  "text-4xl font-bold",
                  isDark ? "text-[#FF9F1C]" : "text-[#FF9F1C]"
                )}>{dueTodayCards}</p>
              </div>

              {/* Upcoming Events */}
              <div className={clsx(
                "p-5 rounded-2xl shadow-sm border card-hover transition-colors",
                isDark
                  ? "bg-[#1A1A1A] border-[#2A2A2A]"
                  : "bg-white border-[#EFEEEE]"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isDark ? "bg-blue-500/20" : "bg-blue-50"
                  )}>
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className={clsx(
                    "text-sm font-medium",
                    isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                  )}>Upcoming</p>
                </div>
                <p className={clsx(
                  "text-4xl font-bold",
                  isDark ? "text-blue-400" : "text-blue-500"
                )}>{upcomingCards}</p>
              </div>

              {/* Active Goals */}
              <div className={clsx(
                "p-5 rounded-2xl shadow-sm border card-hover transition-colors",
                isDark
                  ? "bg-[#1A1A1A] border-[#2A2A2A]"
                  : "bg-white border-[#EFEEEE]"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isDark ? "bg-green-500/20" : "bg-green-50"
                  )}>
                    <Target className="w-5 h-5 text-green-500" />
                  </div>
                  <p className={clsx(
                    "text-sm font-medium",
                    isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                  )}>Active Goals</p>
                </div>
                <p className={clsx(
                  "text-4xl font-bold",
                  isDark ? "text-green-400" : "text-green-500"
                )}>{activeGoals}</p>
              </div>

              {/* Revenue */}
              <div className={clsx(
                "p-5 rounded-2xl shadow-sm border card-hover transition-colors",
                isDark
                  ? "bg-[#1A1A1A] border-[#2A2A2A]"
                  : "bg-white border-[#EFEEEE]"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isDark ? "bg-yellow-500/20" : "bg-yellow-50"
                  )}>
                    <PesoIcon className="w-5 h-5 text-yellow-600" />
                  </div>
                  <p className={clsx(
                    "text-sm font-medium",
                    isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                  )}>This Month</p>
                </div>
                <p className={clsx(
                  "text-3xl font-bold",
                  isDark ? "text-yellow-400" : "text-yellow-600"
                )}>₱{thisMonthRevenue.toLocaleString()}</p>
              </div>
            </div>

            {/* First Task Today */}
            <div className={clsx(
              "p-5 rounded-2xl shadow-sm border transition-colors",
              isDark
                ? "bg-gradient-to-r from-[#1A1A1A] to-[#2A2A2A] border-[#2A2A2A]"
                : "bg-gradient-to-r from-[#FFF2E0] to-[#FFFBF5] border-[#FFD699]"
            )}>
              <div className="flex items-center gap-3 mb-2">
                <Zap className={clsx(
                  "w-5 h-5",
                  isDark ? "text-[#FF9F1C]" : "text-[#FF9F1C]"
                )} />
                <p className={clsx(
                  "text-sm font-semibold",
                  isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
                )}>First Task Today</p>
              </div>

              {firstTask ? (
                <div className="flex items-center gap-4">
                  {firstTask.time && (
                    <span className={clsx(
                      "text-lg font-bold px-3 py-1 rounded-lg",
                      isDark ? "bg-[#FF9F1C]/20 text-[#FF9F1C]" : "bg-[#FF9F1C] text-white"
                    )}>
                      {formatTimeTo12h(firstTask.time)}
                    </span>
                  )}
                  <p className={clsx(
                    "text-xl font-semibold",
                    isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                  )}>
                    {firstTask.description || firstTask.planTitle}
                  </p>
                </div>
              ) : (
                <p className={clsx(
                  "text-lg",
                  isDark ? "text-gray-500" : "text-gray-400"
                )}>
                  No tasks scheduled for today 🎉
                </p>
              )}
            </div>
          </div>

          {/* Right Column - Calendar & Schedule */}
          <div className="space-y-6">

            {/* Mini Calendar */}
            <div className={clsx(
              "p-4 rounded-2xl shadow-sm border transition-colors",
              isDark
                ? "bg-[#1A1A1A] border-[#2A2A2A]"
                : "bg-white border-[#EFEEEE]"
            )}>
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className={clsx(
                  "font-semibold",
                  isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                )}>
                  {format(currentDate, 'MMMM yyyy')}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                    className={clsx(
                      "p-1 rounded-lg transition-colors",
                      isDark ? "hover:bg-[#2A2A2A]" : "hover:bg-gray-100"
                    )}
                  >
                    <ChevronLeft className={clsx("w-4 h-4", isDark ? "text-gray-400" : "text-gray-500")} />
                  </button>
                  <button
                    onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                    className={clsx(
                      "p-1 rounded-lg transition-colors",
                      isDark ? "hover:bg-[#2A2A2A]" : "hover:bg-gray-100"
                    )}
                  >
                    <ChevronRight className={clsx("w-4 h-4", isDark ? "text-gray-400" : "text-gray-500")} />
                  </button>
                </div>
              </div>

              {/* Week headers */}
              <div className="grid grid-cols-7 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className={clsx(
                    "text-center text-xs font-medium py-1",
                    isDark ? "text-gray-500" : "text-gray-400"
                  )}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map(day => {
                  const isToday = isSameDay(day, new Date())
                  const isCurrentMonth = isSameMonth(day, monthStart)
                  const hasPlans = plans.some(p => p.date === format(day, 'yyyy-MM-dd'))

                  return (
                    <div
                      key={day.toString()}
                      className={clsx(
                        "aspect-square flex items-center justify-center text-xs rounded-lg relative",
                        isToday
                          ? "bg-[#FF9F1C] text-white font-bold"
                          : isCurrentMonth
                            ? isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                            : isDark ? "text-gray-600" : "text-gray-300"
                      )}
                    >
                      {format(day, 'd')}
                      {hasPlans && !isToday && (
                        <div className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#FF9F1C]" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Today's Schedule */}
            <div className={clsx(
              "p-4 rounded-2xl shadow-sm border transition-colors",
              isDark
                ? "bg-[#1A1A1A] border-[#2A2A2A]"
                : "bg-white border-[#EFEEEE]"
            )}>
              <h3 className={clsx(
                "font-semibold mb-3 flex items-center gap-2",
                isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
              )}>
                <Clock className="w-4 h-4 text-[#FF9F1C]" />
                Today's Schedule
              </h3>

              {todaysSchedule.length === 0 ? (
                <p className={clsx(
                  "text-sm text-center py-4",
                  isDark ? "text-gray-500" : "text-gray-400"
                )}>
                  No scheduled times today
                </p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {todaysSchedule.map((item, idx) => (
                    <div
                      key={idx}
                      className={clsx(
                        "flex items-center gap-3 p-2 rounded-lg",
                        item.completed
                          ? isDark ? "bg-green-900/20" : "bg-green-50"
                          : isDark ? "bg-[#2A2A2A]" : "bg-[#FFF2E0]"
                      )}
                    >
                      <span className={clsx(
                        "text-sm font-medium",
                        isDark ? "text-[#FF9F1C]" : "text-[#CC7A00]"
                      )}>
                        {formatTimeTo12h(item.time)}
                      </span>
                      <span className={clsx(
                        "text-sm flex-1 truncate",
                        item.completed && "line-through",
                        isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
                      )}>
                        {item.description || item.planTitle}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Other tasks */}
              {todaysPlans.filter(p => !p.timeSlots || p.timeSlots.length === 0).length > 0 && (
                <>
                  <div className={clsx(
                    "border-t my-3",
                    isDark ? "border-[#2A2A2A]" : "border-[#EFEEEE]"
                  )} />
                  <p className={clsx(
                    "text-xs mb-2",
                    isDark ? "text-gray-500" : "text-gray-400"
                  )}>
                    Other Tasks
                  </p>
                  <div className="space-y-1">
                    {todaysPlans.filter(p => !p.timeSlots || p.timeSlots.length === 0).slice(0, 3).map(plan => (
                      <div
                        key={plan.id}
                        className={clsx(
                          "text-sm p-2 rounded-lg truncate",
                          plan.completed
                            ? isDark ? "bg-green-900/20 line-through" : "bg-green-50 line-through"
                            : isDark ? "bg-[#2A2A2A]" : "bg-gray-50"
                        )}
                      >
                        <span className={isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"}>
                          {plan.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Productivity */}
            <div className={clsx(
              "p-4 rounded-2xl shadow-sm border transition-colors",
              isDark
                ? "bg-[#1A1A1A] border-[#2A2A2A]"
                : "bg-white border-[#EFEEEE]"
            )}>
              <h3 className={clsx(
                "font-semibold mb-3 flex items-center gap-2",
                isDark ? "text-[#F5F5F5]" : "text-[#2D3436]"
              )}>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Productivity
              </h3>

              <div className="flex items-center justify-between">
                <div>
                  <p className={clsx(
                    "text-3xl font-bold",
                    isDark ? "text-green-400" : "text-green-500"
                  )}>
                    {completedToday}
                    <span className={clsx(
                      "text-lg font-normal ml-1",
                      isDark ? "text-gray-500" : "text-gray-400"
                    )}>
                      / {totalToday}
                    </span>
                  </p>
                  <p className={clsx(
                    "text-xs",
                    isDark ? "text-gray-500" : "text-gray-400"
                  )}>
                    tasks completed today
                  </p>
                </div>
                {totalToday > 0 && (
                  <div className={clsx(
                    "w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold",
                    completedToday === totalToday
                      ? "bg-green-500/20 text-green-500"
                      : isDark ? "bg-[#2A2A2A] text-[#F5F5F5]" : "bg-gray-100 text-[#2D3436]"
                  )}>
                    {Math.round((completedToday / totalToday) * 100)}%
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Quote */}
      <div className={clsx(
        "mt-8 pt-6 border-t text-center",
        isDark ? "border-[#2A2A2A]" : "border-[#EFEEEE]"
      )}>
        <p className={clsx(
          "text-lg md:text-xl italic",
          isDark ? "text-[#A0A0A0]" : "text-[#636E72]"
        )}>
          💡 "{dailyQuote.text}"
        </p>
        <p className={clsx(
          "text-base mt-2",
          isDark ? "text-gray-500" : "text-gray-400"
        )}>
          — {dailyQuote.author}
        </p>
      </div>
    </div>
  )
}
