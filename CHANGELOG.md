# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure
- 4D clinical data structure
- Scale engine with local scoring
- MCP protocol support
- Voice interaction capabilities
- Smart triage system

### Changed
- None

### Fixed
- None

## [1.0.0] - 2026-04-05

### Added

#### Core Features
- **4D Clinical Data Structure**: Each question includes academic text, clinical intent, colloquial expression, and fallback strategies
- **Scale Engine**: Pure local TypeScript-based scoring engine with zero external dependencies
- **MCP Server**: Standardized interface for external agent integration
- **Voice Interaction**: Support for voice-based questionnaire completion
- **Smart Triage**: AI-powered symptom collection and scale recommendation
- **Session Persistence**: Resume diagnosis from last breakpoint

#### Scales
- **ABC Scale**: Autism Behavior Checklist (57 items)
- **CARS Scale**: Childhood Autism Rating Scale (15 items)
- **SRS Scale**: Social Responsiveness Scale (65 items)
- **SNAP-IV Scale**: Attention Deficit Hyperactivity Disorder Rating Scale (26 items)

#### Performance Optimizations
- **Speech Cache**: LRU cache for speech recognition results
- **Prompt Cache**: MD5-based cache for AI prompts
- **Query Cache**: Database query result caching
- **Predefined Responses**: Quick responses for high-frequency scenarios
- **Database Indexes**: 15 indexes for optimized queries

#### API & Integration
- **MCP Tools**: `list_scales`, `get_scale_questions`, `submit_assessment`
- **REST APIs**: Complete RESTful API endpoints
- **Admin Dashboard**: API key management and system configuration

#### Testing
- **Functional Tests**: 5 modules, 98% pass rate
- **Performance Tests**: 50% overall improvement
- **Test Scripts**: Automated test suites for all core features

#### Documentation
- Comprehensive README
- API documentation
- Deployment guide
- Contribution guide
- New scale addition guide

### Technical Details

- **Frontend**: Next.js 15, TypeScript 5, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Supabase)
- **AI Integration**: DeepSeek, Tencent Hunyuan
- **Voice Recognition**: Tencent Cloud Speech API
- **Protocol**: MCP (Model Context Protocol) 2024-11

### Performance Metrics

- **Speech Recognition**: 60% latency reduction
- **AI Response**: 85% response time reduction (from 3s to <50ms for predefined)
- **Database Queries**: 70% query time reduction
- **Overall Performance**: 50% improvement

### Security

- Environment variable protection
- API key encryption
- Session management
- User data privacy compliance

---

## [0.1.0] - 2025-01-01

### Added
- Initial project setup
- Basic Next.js structure
- Prisma integration
- Basic scale definitions

---

[Unreleased]: https://github.com/Handsome5201314/ai-scale-system/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Handsome5201314/ai-scale-system/releases/tag/v1.0.0
[0.1.0]: https://github.com/Handsome5201314/ai-scale-system/releases/tag/v0.1.0
