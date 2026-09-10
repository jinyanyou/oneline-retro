'use strict';

/**
 * 한마디 엔트리 API — Lambda 진입점.
 *
 * 라우팅과 검증은 core.js 에 있고 여기서는 저장소만 골라 끼운다.
 * 로컬 서버(local/server.js)가 같은 core 를 파일 저장소로 재사용한다.
 */
const { createHandler } = require('./core');
const { store } = require('./dynamo-store');

exports.handler = createHandler(store);
