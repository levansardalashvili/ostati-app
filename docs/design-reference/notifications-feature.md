Continue the existing app and create the Notifications experience for both Customer and Provider.

Keep the current visual design system and do not redesign unrelated screens.

All visible UI text must be in Georgian.

## Notifications Screen

Create a shared Notifications screen.

Header:

"შეტყობინებები"

Show notifications in a clean vertical list.

Each notification item should include:

* Relevant icon or avatar
* Notification title
* Short supporting text
* Time/date
* Unread indicator when applicable

Unread notifications should use a subtle blue indicator.

Do not make the notification list visually heavy.

## Customer Notifications

Create examples for these notification types:

### New Provider Interest

Title:

"ახალი ოსტატი დაინტერესდა"

Example supporting text:

"გიორგი ბერიძე დაინტერესდა შენს მოთხოვნით — ონკანის შეკეთება"

Time:

"5 წუთის წინ"

Tapping this opens the existing Customer Job Details screen.

### New Chat Message

Title:

"ახალი შეტყობინება"

Example:

"გიორგი ბერიძე: კი, დღეს 16:00-ზე შემიძლია მოსვლა."

Tapping opens the existing Conversation screen.

### Provider Selected / Job Confirmed

Title:

"მოთხოვნა დადასტურებულია"

Supporting text:

"გიორგი ბერიძე არჩეულია სამუშაოსთვის."

Tapping opens the confirmed Customer Job Details screen.

### Completion Reminder

Title:

"სამუშაო დასრულდა?"

Supporting text:

"დაადასტურე შესრულდა თუ არა სამუშაო."

Tapping opens the completion confirmation state.

### Job Completed

Title:

"მოთხოვნა დასრულებულია"

Supporting text:

"ახლა შეგიძლია შეაფასო ოსტატი."

Tapping opens the Rating screen or completed Job Details.

## Provider Notifications

Create examples for these notification types:

### New Job Opportunity

Title:

"ახალი მოთხოვნა შენს რაიონში"

Supporting text:

"სანტექნიკოსი • ვაკე • დღეს"

Tapping opens the existing Provider Job Details screen.

IMPORTANT:

Provider receives new job opportunity push notifications ONLY when availability is ON.

If availability is OFF, do not send new-job push notifications.

The job feed itself must still remain visible.

### New Chat Message

Title:

"ახალი შეტყობინება"

Example:

"ნინო: შეგიძლიათ დღეს მოსვლა?"

Tapping opens the existing Conversation.

### Selected for Job

Title:

"შენ აგირჩიეს სამუშაოსთვის"

Supporting text:

"ონკანიდან წყალი ჟონავს • ვაკე"

Tapping opens Provider Job Details in the selected/confirmed state.

### Job Closed

Title:

"მოთხოვნა დაიხურა"

Supporting text:

"მომხმარებელმა სხვა ოსტატი აირჩია."

Use neutral styling.

### Job Completed

Title:

"სამუშაო დასრულებულად დადასტურდა"

Supporting text:

"მომხმარებელმა დაადასტურა სამუშაოს დასრულება."

Tapping opens the completed Provider Job Details screen.

### Rating Received

Title:

"ახალი შეფასება მიიღე"

Supporting text:

"★★★★★ 5.0"

Tapping opens the Provider Reviews screen or relevant completed job.

## Read / Unread States

Unread notification:

* Subtle blue dot
* Slightly stronger text weight
* Optional very light blue background

Read notification:

* Neutral background
* No unread indicator

Do not rely only on color to communicate unread state.

## Mark as Read

Opening a notification should mark it as read.

Optionally add:

"ყველას წაკითხვად მონიშვნა"

Keep this action visually secondary.

## Empty State

Create an empty Notifications state.

Title:

"შეტყობინებები ჯერ არ გაქვს"

Supporting text:

"ახალი აქტივობა აქ გამოჩნდება."

Use a simple notification/bell illustration or icon.

Do not make this look like an error.

## Notification Bell

Reuse a notification bell icon in appropriate Home/Profile headers.

If there are unread notifications, show a small badge or dot.

Tapping the bell opens this Notifications screen.

## Notification Settings

Use the existing Notification Settings screen from Profile.

### Customer Settings

Toggle options:

* "ახალი ინტერესი ჩემს მოთხოვნაზე"
* "ახალი შეტყობინება ჩატში"
* "მოთხოვნის სტატუსის ცვლილება"
* "სამუშაოს დასრულების შეხსენება"

### Provider Settings

Toggle options:

* "ახალი მოთხოვნები ჩემს რაიონში"
* "ახალი შეტყობინება ჩატში"
* "სამუშაოზე არჩევა"
* "მოთხოვნის სტატუსის ცვლილება"
* "ახალი შეფასება"

IMPORTANT:

If Provider availability is OFF, new job opportunity push notifications remain disabled even if the notification setting itself is enabled.

Chat notifications should still work.

## Push Notification Logic

Design the in-app notification center only.

Do not create detailed operating-system push notification layouts.

The app should support push notifications for:

Customer:

* New Provider interest
* New chat message
* Job status change
* Completion reminder

Provider:

* New job opportunity when availability is ON
* New chat message
* Selected for job
* Job status change
* New rating

## Privacy

Do not include:

* Phone numbers
* Emails
* Exact addresses

inside notification previews.

Use only safe information such as:

* First name / Provider name
* Job title
* Category
* District
* Status

## Navigation

Customer:

Provider Interest Notification
→ Customer Job Details

Chat Notification
→ Conversation

Completion Reminder
→ Completion Confirmation

Rating Reminder
→ Rating Screen

Provider:

New Job Notification
→ Provider Job Details

Chat Notification
→ Conversation

Selected Notification
→ Provider Job Details

Completed Notification
→ Completed Job Details

Rating Notification
→ Reviews

## Important

* Reuse the existing notification bell and status styles.
* Do not create payment notifications.
* Do not create phone/SMS notification flows.
* Customer and Provider use the same overall Notifications screen design.
* Notification content changes based on user role.
* Reuse existing components and styles.
* Do not modify unrelated screens.
