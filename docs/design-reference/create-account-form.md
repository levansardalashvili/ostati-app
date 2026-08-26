Continue using the EXACT same visual design system established in the previous screens.

Do NOT redesign the existing Welcome or Role Selection screens.

Now create the Registration / Account Creation flow.

IMPORTANT:

Do NOT use phone number authentication.

Do NOT create SMS verification or OTP code screens.

Users should be able to create an account in TWO ways:

1. Register manually using their personal information, email and password
2. Continue / register using Google

All visible user-facing UI text must be in Georgian.

# SCREEN — CREATE ACCOUNT

At the top include:

* Back arrow
* Progress indicator consistent with the onboarding flow

Title:

"ანგარიშის შექმნა"

Supporting text:

"შეიყვანე შენი მონაცემები რეგისტრაციის გასაგრძელებლად."

# PERSONAL INFORMATION

Create a clean registration form.

## Full Name

Label:

"სახელი და გვარი"

Placeholder:

"მაგ. გიორგი ბერიძე"

Use a standard text input.

## Email Address

Label:

"ელ. ფოსტა"

Placeholder:

"[example@email.com](mailto:example@email.com)"

Use an email input with an appropriate email icon if it matches the existing design system.

Validate that the email format is correct.

## Address

Label:

"მისამართი"

Placeholder:

"მაგ. თბილისი, ვაკე"

Use a location pin icon.

This field represents the user's general address/location.

Keep the UI simple and do not request unnecessary detailed location information.

## Password

Label:

"პაროლი"

Create a secure password input.

Add an eye icon to show/hide the password.

Use appropriate validation.

Password should contain at least 8 characters.

Add subtle helper text:

"მინიმუმ 8 სიმბოლო"

## Confirm Password

Label:

"გაიმეორე პაროლი"

Create another secure password input.

Add the same show/hide password functionality.

Validate that both passwords match.

If they do not match, show:

"პაროლები არ ემთხვევა"

# TERMS AND PRIVACY

Below the form add a checkbox.

Text:

"ვეთანხმები მომსახურების პირობებს და კონფიდენციალურობის პოლიტიკას"

Make:

"მომსახურების პირობებს"

and

"კონფიდენციალურობის პოლიტიკას"

visually identifiable as clickable links.

The registration button should remain disabled until the user accepts these terms.

# PRIMARY REGISTRATION ACTION

Create a large full-width primary button:

"რეგისტრაცია"

Use the same primary blue button style already established throughout the application.

The button should be disabled until all required fields are correctly completed.

# GOOGLE REGISTRATION

Below the primary registration button add a visual separator:

"ან"

Then create a large secondary authentication button:

"Google-ით გაგრძელება"

Include the official-style Google "G" icon.

Keep this button visually secondary to the main registration button.

It should have:

* White/light background
* Subtle border
* Google icon
* Centered text

Do NOT create Facebook, Apple, phone number, SMS, or other social authentication options at this stage.

# GOOGLE REGISTRATION BEHAVIOR

When the user taps:

"Google-ით გაგრძელება"

the application should use the Google account to create the user's account.

If Google already provides:

* Full name
* Email
* Profile photo

use this information automatically.

Do not ask the user to manually re-enter information already provided by Google.

However, if required information such as the user's address/location is missing, show a short profile completion screen after Google authentication.

# GOOGLE PROFILE COMPLETION

Create an additional state for users who registered through Google.

Title:

"დაასრულე პროფილის შექმნა"

Supporting text:

"დაგვჭირდება კიდევ რამდენიმე ინფორმაცია."

Show information already received from Google:

* Profile photo
* Full name
* Email

These should be pre-filled.

Then request only the missing required information.

For example:

"მისამართი"

Primary button:

"გაგრძელება"

Do NOT ask the user to create a password when registering through Google.

# ROLE LOGIC

The role selected on the previous Role Selection screen must be preserved.

If the user previously selected:

"მე ვეძებ ოსტატს"

continue registration as a Customer.

If the user selected:

"მე ვარ ოსტატი"

continue registration as a Provider.

Do NOT ask the user to select their role again.

# AFTER CUSTOMER REGISTRATION

After a Customer successfully creates an account:

Continue to the Customer profile setup if additional information is required.

Then route to the existing Customer Home screen.

# AFTER PROVIDER REGISTRATION

After a Provider successfully creates an account:

Continue to the existing Provider Profile Setup screen where they can add:

* Profile photo
* Specialty / specialties
* Years of experience
* Service areas
* About description

Then route to the existing Provider Home screen.

# EXISTING ACCOUNT

At the bottom of the registration screen include:

"უკვე გაქვს ანგარიში?"

Action:

"შესვლა"

Tapping "შესვლა" opens the Login screen.

# LOGIN SCREEN

Update the Login experience to match the new authentication system.

Title:

"შესვლა"

Fields:

"ელ. ფოსტა"

"პაროლი"

Primary button:

"შესვლა"

Add:

"დაგავიწყდა პაროლი?"

Below add separator:

"ან"

Then:

"Google-ით გაგრძელება"

Also show:

"არ გაქვს ანგარიში? რეგისტრაცია"

Do NOT use phone number or SMS verification for login.

# FORGOT PASSWORD

Create a simple Forgot Password screen.

Title:

"პაროლის აღდგენა"

Supporting text:

"შეიყვანე შენი ელ. ფოსტა და გამოგიგზავნით პაროლის აღდგენის ინსტრუქციას."

Field:

"ელ. ფოსტა"

Primary button:

"აღდგენის ბმულის გაგზავნა"

Create a success state:

"ბმული გამოგზავნილია"

Supporting text:

"შეამოწმე შენი ელ. ფოსტა პაროლის აღსადგენად."

# FORM VALIDATION

Create consistent validation states.

Examples:

Invalid email:

"შეიყვანე სწორი ელ. ფოსტა"

Password too short:

"პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს"

Passwords do not match:

"პაროლები არ ემთხვევა"

Required field:

"ეს ველი სავალდებულოა"

Existing email:

"ამ ელ. ფოსტით ანგარიში უკვე არსებობს"

Provide an action:

"შესვლა"

# LOADING STATES

Create consistent loading states for:

* Manual registration
* Google authentication
* Login
* Password reset

While processing, disable duplicate submissions and show a subtle loading indicator inside the relevant button.

# AUTHENTICATION FLOW

MANUAL REGISTRATION:

Role Selection
→ Create Account
→ Enter Full Name + Email + Address + Password
→ Register
→ Customer Profile Setup OR Provider Profile Setup
→ Correct Home screen

GOOGLE REGISTRATION:

Role Selection
→ Create Account
→ Google-ით გაგრძელება
→ Google Authentication
→ Complete Missing Profile Information if necessary
→ Customer Profile Setup OR Provider Profile Setup
→ Correct Home screen

EXISTING USER:

Welcome
→ Login
→ Email + Password OR Google
→ Detect Existing Account Role
→ Correct Home screen

# IMPORTANT REQUIREMENTS

1. Remove phone number authentication completely.

2. Remove SMS verification completely.

3. Remove OTP code screens completely.

4. Manual registration uses:

   * Full name
   * Email
   * Address
   * Password
   * Confirm password

5. Google registration must also be available.

6. Google users do NOT need to create a password.

7. One account still has only ONE role: Customer OR Provider.

8. Preserve the role selected before registration.

9. Do not create role switching inside the application.

10. Maintain the same visual style as all previously created screens.

# DESIGN REQUIREMENTS

Do NOT introduce a new visual style.

Reuse the existing:

* Colors
* Typography
* Inputs
* Buttons
* Cards
* Border radius
* Icons
* Spacing

The registration experience should feel:

* Simple
* Fast
* Trustworthy
* Modern
* Professional

Create polished, high-fidelity, production-ready mobile UI.

Do NOT create wireframes.
