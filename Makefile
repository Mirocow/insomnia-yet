ifneq (,$(wildcard ./.env))
    include .env
    $(eval export $(shell sed -ne 's/ *#.*$$//; /./ s/=.*$$// p' .env))
endif
appName = ${COMPOSE_PROJECT_NAME}
args = $(filter-out $@,$(MAKECMDGOALS))
OS_NAME := $(shell uname -s | tr A-Z a-z)
ifeq ($(OS_NAME),darwin)
    $(eval export UID=1000)
    $(eval export GID=1000)
else
    $(eval export UID=$(shell id -u))
    $(eval export GID=$(shell id -g))
endif

.DEFAULT_GOAL := help
.PHONY: help

help:
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	| sed -n 's/^\(.*\): \(.*\)##\(.*\)/\1 - \3/p' \
	| column -t -s ' '

# -----------------------------------------------------

install: ## Установка всех необходимых пакетов 
	npm install

update: ## Проверка установленных пакетов на наличие обновления] 
	npm outdated

start: ## Запуск приложения в режиме окна
	npm run dev

start-debug: ## Запуск приложения в режиме окна (With debug mode)
	npm run dev-debug

watch: ## Запуск приложения на порту 3334
	npm run watch:app

check: ## Проверка проекта на наличие ошибок
	cd packages/insomnia && npm run lint && cd ../..

check-fix: ## Проверка проекта на наличие ошибок с исправлениями
	cd packages/insomnia && npm run lint-fix && cd ../..

build: ## Сборка приложения
	cd packages/insomnia &&	npm run build && cd ../..

build-js: ## Сборка приложения (JS)
	cd packages/insomnia &&	npm run build:main.min.js && cd ../..

build-svg: ## Сборка приложения (SVG)
	cd packages/insomnia &&	npm run convert-svg && cd ../..

tests-all: ## Запуск всех тестов
	cd packages/insomnia &&	npm run test && cd ../..

tests: ## Запуск указанных тестов (передается папка или файл)
	cd packages/insomnia && npm run test:script '${args}'

package: ## Сборка приложения
	npm run app-package

clean: ## Очистка проекта от сборки
	npm run clean

# Remove error message about lacking rules for targets' parameters
%:
	@: