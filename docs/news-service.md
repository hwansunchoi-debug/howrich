# 대한민국 실시간 뉴스 이슈 서비스

여러 언론사의 기사를 모아 **같은 사건끼리 하나의 이슈로 묶고**, 지금 가장 크게
번지고 있는 순서로 보여준다. 이슈를 열면 **시간대별 한 줄 요약(타임라인)** 만
훑어봐도 그 이슈가 어떻게 진행됐는지 알 수 있다.

로그인·댓글·개인화 없이, 읽는 것만 되는 최소 버전이다.

| 경로 | 화면 |
| --- | --- |
| `/` | 메인: 현재 주요 이슈 목록 |
| `/issue/:issueId` | 이슈 상세: 현재 상황 + 기사 타임라인 |

---

## 1. 전체 흐름

```
RSS / 뉴스 API
      ↓  news-collect
  articles 저장 (제목·언론사·발행시간·URL·요약)
      ↓  news-cluster (Claude)
  기존 이슈에 추가 또는 새 이슈 생성 (issues, issue_articles)
      ↓  refresh_issue_scores()
  이슈 점수 갱신 (기사 수 / 증가 속도 / 최신성)
      ↓  news-timeline (Claude)
  시간대별 한 줄 요약 생성 (timeline_events)
      ↓
  웹페이지에 반영 (1분마다 자동 새로고침)
```

`news-pipeline` Edge Function 이 위 단계를 순서대로 모두 실행한다.
pg_cron 이 **5분마다** 이 함수를 호출한다.

---

## 2. 데이터베이스

마이그레이션: `supabase/migrations/20260829010000_news_issue_timeline.sql`

| 테이블 | 내용 |
| --- | --- |
| `news_sources` | RSS/API 수집 소스 목록, 소스별 마지막 수집 결과 |
| `articles` | 기사 제목·언론사·발행 시간·URL·요약·수집 시간 (원문 전체는 저장하지 않음) |
| `issues` | 이슈 제목·한 줄 설명·이슈 점수·기사 수·추세·최근 업데이트 시간 |
| `issue_articles` | 이슈 ↔ 기사 연결 (한 기사는 하나의 이슈에만 속한다) |
| `timeline_events` | 이슈별 시간대(1시간) 요약 |
| `unclustered_articles` (뷰) | 아직 AI 분류를 거치지 않은 기사 |

**RLS**: 모든 테이블은 누구나 읽을 수 있고(`select`), 쓰기는 `service_role`
(Edge Function)만 가능하다. 로그인·회원가입 없이 열람 전용으로 동작한다.

`20260829020000_drop_household_ledger.sql` 은 이전 가계부 기능의 테이블·함수를
삭제하는 마이그레이션이다. 적용하면 거래내역 등 가계부 데이터가 영구히 사라진다.
2025년 날짜의 마이그레이션 파일들은 이미 원격 DB 에 적용된 이력이라
`supabase db push` 가 어긋나지 않도록 지우지 않고 그대로 둔다.

### 이슈 점수

`refresh_issue_scores()` 함수가 계산한다. 초기 버전은 이해하기 쉬운 합산 방식이다.

```
issue_score = 기사량 + 증가속도 + 최신성

기사량   = 12 × ln(1 + 최근 24시간 기사 수)
증가속도 = clamp(-10, 30, 20 × ((최근 1시간 + 1) / (직전 1시간 + 1) − 1))
           × min(1, 최근 1시간 기사 수 / 3)
최신성   = 30 × exp(−(마지막 기사 이후 경과 시간(시간)) / 6)
```

- **증가속도**: 지금이 오후 7시라면 `18~19시 기사 수`와 `17~18시 기사 수`를 비교한다.
  갑자기 기사가 몰린 이슈가 위로 올라온다. 기사가 1~2건뿐인데 증가율만 커 보이는
  경우를 막기 위해 최근 1시간 기사 수가 3건이 될 때까지는 비례해서 줄여 반영한다.
- **최신성**: 기사 수가 많아도 최근 업데이트가 없으면 점수가 빠르게 떨어진다.
- `trend` 컬럼(`surging` / `rising` / `steady` / `cooling`)은 목록에서
  "급상승 / 상승" 배지로 표시된다.

---

## 3. Edge Functions

| 함수 | 하는 일 |
| --- | --- |
| `news-collect` | 활성화된 RSS 소스를 모두 읽어 새 기사를 저장한다. 소스별 성공/실패를 응답과 `news_sources.last_status` 에 기록한다. |
| `news-cluster` | 미분류 기사(기본 40건)를 Claude 로 분석해 기존 이슈에 넣거나 새 이슈를 만든다. 이후 점수를 갱신한다. |
| `news-timeline` | 새 기사가 들어온 상위 이슈(기본 6개)의 시간대별 요약을 만든다. |
| `news-pipeline` | 위 세 가지를 한 번에 실행한다. cron 이 호출하는 함수. |

AI 판단 원칙은 각 함수의 시스템 프롬프트에 들어 있다.

- **이슈 분류**: 단어가 겹치는지가 아니라 *같은 사건인지*로 판단한다.
  맞는 기존 이슈가 있으면 반드시 거기에 넣고, 없을 때만 새 이슈를 만든다.
  광고·부고·날씨·운세·시황 반복 기사는 이슈로 만들지 않는다.
- **타임라인 요약**: 기사 제목을 이어붙이지 않고, 그 시간대에 새로 확인된 변화만
  한 문장(60자 이내)으로 쓴다. 이전 시간대 요약을 함께 넘겨 같은 말을 반복하지
  않게 하고, 기사에 없는 내용은 추측하지 않는다.

### 환경 변수 (Supabase Secrets)

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | ✅ | Claude API 키. 없으면 수집·점수 갱신만 동작하고 AI 단계는 건너뛴다. |
| `NEWS_AI_MODEL` | | 기본 `claude-opus-5` |
| `NEWS_AI_EFFORT` | | 기본 `low`. 요약 품질을 올리려면 `medium` / `high` |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 는 Edge Function 런타임이 자동 주입한다.

---

## 4. 배포 순서

```bash
# 1) 테이블 생성
supabase db push

# 2) Claude API 키 등록
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# 3) 함수 배포
supabase functions deploy news-collect
supabase functions deploy news-cluster
supabase functions deploy news-timeline
supabase functions deploy news-pipeline

# 4) 한 번 직접 실행해 보기
curl -X POST "https://<PROJECT-REF>.supabase.co/functions/v1/news-pipeline" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" -d '{}'
```

응답의 `steps.collect.sources` 에 소스별 결과가 들어 있다.

```json
{ "name": "연합뉴스", "status": "error", "error": "HTTP 404" }
```

`news_sources.source_type` 은 `rss` 와 `api` 를 구분해 두었고, 현재 수집기는
`rss` 소스만 읽는다. 공식 뉴스 API 를 붙일 때 `api` 분기만 추가하면 된다.

RSS 주소는 언론사 사정으로 바뀌는 경우가 있다. **실패한 소스는 코드 수정 없이
DB 에서 고치면 된다.**

```sql
-- 주소 수정
update news_sources set feed_url = '새 주소' where name = '연합뉴스';
-- 잠시 끄기
update news_sources set enabled = false where name = 'JTBC';
-- 새 소스 추가
insert into news_sources (name, feed_url, category) values ('오마이뉴스', 'https://...', '종합');
-- 상태 확인
select name, last_status, last_error, last_fetched_at from news_sources order by last_status;
```

### 5분마다 자동 실행

`supabase/sql/news_pipeline_cron.sql` 을 Supabase 대시보드 SQL Editor 에서
실행한다. (프로젝트 URL 과 service_role key 두 곳만 각자 값으로 바꾼다.
값은 Vault 에 저장되므로 Git 에 커밋하지 않는다.)

```sql
select * from cron.job;                                        -- 등록 확인
select * from cron.job_run_details order by start_time desc limit 10;  -- 실행 이력
```

---

## 5. 화면 구성

**메인 (`/`)**

- 이슈 점수가 높은 순서대로 최대 20개.
- 각 이슈: 순위, 제목, 한 줄 설명, 최근 24시간 기사 수, 마지막 업데이트 시간,
  급상승/상승 배지.
- 1분마다 자동으로 다시 불러오고, 오른쪽 위 버튼으로 즉시 새로고침한다.

**상세 (`/issue/:issueId`)**

1. 현재 상황 한 줄 요약
2. 기사 타임라인 — 시간대별 한 줄 요약을 최신순으로
3. 시간대를 누르면 그 시간대 기사 목록(언론사 · 제목 · 시간)이 펼쳐지고,
   제목을 누르면 언론사 원문으로 이동한다.

시간은 사용자의 기기 시간대와 무관하게 항상 한국 시간(KST)으로 표시한다.
아직 요약이 만들어지지 않은 시간대도 "요약 준비 중" 으로 기사와 함께 보여준다.

---

## 6. 비용 관리

파이프라인 1회 실행당 Claude 호출은 최대 `1(분류) + 6(타임라인)`회이고,
각 호출의 입력은 기사 제목 수십 건 정도로 작다. 더 줄이고 싶다면:

- cron 주기를 `*/10 * * * *` 로 늘린다.
- `news-pipeline` 호출 본문에 `{"maxIssues": 3, "maxArticles": 25}` 를 넣는다.
- `NEWS_AI_EFFORT` 를 `low` 로 둔다. (기본값)

---

## 7. 다음 단계 후보

초기 버전에는 일부러 넣지 않았다.

- 이슈 검색 / 카테고리 필터
- 이슈 병합·분리 수동 보정 화면
- 이슈 알림(푸시)
- 지난 이슈 아카이브 (현재는 7일이 지난 기사를 자동 정리한다)
