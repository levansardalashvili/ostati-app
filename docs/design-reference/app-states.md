Continue the existing app and create reusable System States for the entire application.

Keep the current visual design system and do not redesign unrelated screens.

All visible UI text must be in Georgian.

## Goal

Create consistent reusable states for:

* Loading
* Empty
* Error
* No Internet
* Form Validation
* Disabled Actions
* Success Feedback

Use the SAME visual language across Customer and Provider experiences.

## Loading States

Create subtle skeleton/loading states for:

* Customer Home provider list
* Provider Home job feed
* Provider Public Profile
* Customer Job Details
* Provider Job Details
* Chats Inbox
* Conversation loading
* Notifications
* My Jobs
* Completed Jobs
* Reviews

Use skeleton placeholders that match the final card/component shapes.

Do not use full-screen spinners unless absolutely necessary.

For button actions, show a small inline loading indicator inside the button.

Examples:

"იტვირთება..."

"იგზავნება..."

"ინახება..."

"ქვეყნდება..."

Disable repeated taps while an action is processing.

## Empty States

Create reusable polished empty states.

### No Providers Found

Title:

"ოსტატები ვერ მოიძებნა"

Supporting text:

"სცადე სხვა კატეგორიის ან რაიონის არჩევა."

Action:

"ფილტრების შეცვლა"

### No Provider Jobs

Title:

"ახალი მოთხოვნები ჯერ არ არის"

Supporting text:

"როცა შენს კატეგორიასა და რაიონში ახალი მოთხოვნა გამოჩნდება, აქ დაინახავ."

### No Customer Jobs

Title:

"მოთხოვნები ჯერ არ გაქვს"

Supporting text:

"გამოაქვეყნე მოთხოვნა და მიიღე გამოხმაურება შესაბამისი ოსტატებისგან."

Action:

"მოთხოვნის გამოქვეყნება"

### No Interested Providers

Title:

"ჯერ არავინ დაინტერესებულა"

Supporting text:

"როცა ოსტატი დაინტერესდება, აქ გამოჩნდება და შეტყობინებასაც მიიღებ."

### No Chats

Title:

"ჩატები ჯერ არ გაქვს"

Customer text:

"ოსტატთან საუბრის დაწყების შემდეგ ჩატი აქ გამოჩნდება."

Provider text:

"მომხმარებელთან საუბრის დაწყების შემდეგ ჩატი აქ გამოჩნდება."

### No Notifications

Title:

"შეტყობინებები ჯერ არ გაქვს"

Supporting text:

"ახალი აქტივობა აქ გამოჩნდება."

### No Reviews

Title:

"შეფასებები ჯერ არ არის"

Supporting text:

"შეფასებები შესრულებული სამუშაოების შემდეგ გამოჩნდება."

Keep all empty states friendly and neutral.

Do not make empty states look like errors.

## Generic Error State

Create a reusable error state.

Title:

"დაფიქსირდა შეცდომა"

Supporting text:

"მონაცემების ჩატვირთვა ვერ მოხერხდა."

Primary action:

"თავიდან ცდა"

Use a subtle warning/error icon.

Do not make the entire screen aggressively red.

## No Internet State

Create a dedicated offline state.

Title:

"ინტერნეტთან კავშირი არ არის"

Supporting text:

"შეამოწმე ინტერნეტთან კავშირი და სცადე თავიდან."

Primary action:

"თავიდან ცდა"

Use an appropriate offline/network icon.

## Form Validation

Create consistent validation styling for all forms.

Examples:

Required field:

"ეს ველი სავალდებულოა"

Invalid email:

"შეიყვანე სწორი ელ. ფოსტა"

Password too short:

"პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს"

Passwords do not match:

"პაროლები არ ემთხვევა"

Missing job category:

"აირჩიე კატეგორია"

Missing district:

"აირჩიე რაიონი"

Short description:

"აღწერა ძალიან მოკლეა"

Do not communicate errors using color alone.

Show clear text below the relevant field.

## Button States

Create reusable button states for:

### Primary Button

* Default
* Pressed
* Disabled
* Loading

### Secondary Button

* Default
* Pressed
* Disabled

### Destructive Button

* Default
* Pressed
* Disabled

Use the SAME button dimensions and styling across the app.

## Success Feedback

Create reusable success feedback patterns for actions such as:

* Account created
* Profile saved
* Job published
* Interest sent
* Provider selected
* Job completed
* Rating submitted

Use:

* Success icon
* Subtle green semantic styling
* Clear confirmation message

Do not create a separate full-screen success page unless the flow already requires it.

For smaller actions, use compact banners/toasts.

## Message Send Failure

Inside Chat, if a message fails to send:

Show a subtle failed state next to the message.

Action:

"თავიდან გაგზავნა"

Do not remove the user's typed message.

## Job Publication Failure

If publishing a job fails:

Show:

"მოთხოვნის გამოქვეყნება ვერ მოხერხდა"

Action:

"თავიდან ცდა"

IMPORTANT:

Keep all entered form data.

Do not clear the form.

## Profile Save Failure

Show:

"ცვლილებების შენახვა ვერ მოხერხდა"

Action:

"თავიდან ცდა"

Keep all edited information in the form.

## Authentication Errors

Use consistent states for:

* Incorrect email/password
* Existing email during registration
* Google sign-in failure
* Password reset failure

Examples:

"ელ. ფოსტა ან პაროლი არასწორია"

"ამ ელ. ფოსტით ანგარიში უკვე არსებობს"

"Google-ით შესვლა ვერ მოხერხდა"

"პაროლის აღდგენის ბმულის გაგზავნა ვერ მოხერხდა"

Provide clear retry or navigation actions.

## Important

* Use the same error/loading/empty visual language everywhere.
* Do not create different styles for Customer and Provider.
* Do not add payment-related states.
* Do not add phone/SMS verification states.
* Preserve entered user data after recoverable errors.
* Reuse existing components.
* Do not modify unrelated screens.
