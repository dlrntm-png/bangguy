#!/usr/bin/env node
/**
 * 자동 커밋 스크립트
 * 변경사항이 있을 때 자동으로 커밋합니다.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 변경사항 확인
function hasChanges() {
  try {
    const status = execSync('git status --porcelain', { 
      cwd: projectRoot, 
      encoding: 'utf8' 
    });
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

// 변경된 파일 목록 가져오기
function getChangedFiles() {
  try {
    const status = execSync('git status --porcelain', { 
      cwd: projectRoot, 
      encoding: 'utf8' 
    });
    return status.trim().split('\n').filter(line => line.trim());
  } catch {
    return [];
  }
}

// 파일 타입에 따른 커밋 메시지 생성
function generateCommitMessage(files) {
  const messages = [];
  
  files.forEach(file => {
    const path = file.replace(/^[AM]+\s+/, '').trim();
    
    if (path.includes('server/index.js')) {
      messages.push('서버 로직 수정');
    } else if (path.includes('public/index.html')) {
      messages.push('프론트엔드 UI 수정');
    } else if (path.includes('package.json')) {
      messages.push('의존성 업데이트');
    } else if (path.includes('README.md') || path.includes('PROJECT_RULES.md')) {
      messages.push('문서 업데이트');
    } else if (path.includes('.gitignore')) {
      messages.push('Git 설정 업데이트');
    } else if (path.includes('.env')) {
      messages.push('환경 변수 설정');
    } else {
      messages.push(`${path} 파일 수정`);
    }
  });
  
  // 중복 제거 및 정리
  const uniqueMessages = [...new Set(messages)];
  
  if (uniqueMessages.length === 1) {
    return uniqueMessages[0];
  } else if (uniqueMessages.length <= 3) {
    return uniqueMessages.join(', ');
  } else {
    return `${uniqueMessages[0]} 외 ${uniqueMessages.length - 1}개 파일 수정`;
  }
}

// 자동 커밋 실행
function autoCommit() {
  if (!hasChanges()) {
    console.log('변경사항이 없습니다.');
    return;
  }
  
  const files = getChangedFiles();
  const message = generateCommitMessage(files);
  
  try {
    // 모든 변경사항 추가
    execSync('git add .', { 
      cwd: projectRoot, 
      stdio: 'inherit' 
    });
    
    // 커밋
    execSync(`git commit -m "${message}"`, { 
      cwd: projectRoot, 
      stdio: 'inherit' 
    });
    
    console.log(`✅ 커밋 완료: ${message}`);
  } catch (error) {
    console.error('❌ 커밋 실패:', error.message);
  }
}

// 실행
autoCommit();

