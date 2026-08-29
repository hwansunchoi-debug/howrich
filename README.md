# Welcome to your Lovable project

## 지금 대한민국 - 실시간 뉴스 이슈

여러 언론사의 RSS 기사를 모아 AI가 같은 사건끼리 하나의 이슈로 묶고,
이슈별로 시간대별 한 줄 요약(타임라인)을 만들어 보여주는 서비스.

- `/` 현재 주요 이슈 목록 (이슈 점수 순, 1분마다 자동 갱신)
- `/issue/:issueId` 이슈 상세 - 현재 상황 요약 + 기사 타임라인

설정·배포·동작 방식은 [`docs/news-service.md`](docs/news-service.md) 참고.

> 이 저장소에 있던 가계부 앱은 제거했다. 코드는 `main` 브랜치와 이전 커밋에 남아 있고,
> DB 테이블 삭제는 `supabase/migrations/20260829020000_drop_household_ledger.sql` 로 처리한다.

## Project info

**URL**: https://lovable.dev/projects/c0a4fb86-f8d0-472d-bbde-6e2d97cc99e3

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/c0a4fb86-f8d0-472d-bbde-6e2d97cc99e3) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/c0a4fb86-f8d0-472d-bbde-6e2d97cc99e3) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
