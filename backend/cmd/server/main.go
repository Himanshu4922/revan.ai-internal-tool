package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/ravan-ai/agni-keymon/internal/alerts"
	"github.com/ravan-ai/agni-keymon/internal/auth"
	"github.com/ravan-ai/agni-keymon/internal/config"
	"github.com/ravan-ai/agni-keymon/internal/crypto"
	"github.com/ravan-ai/agni-keymon/internal/db"
	"github.com/ravan-ai/agni-keymon/internal/handlers"
	"github.com/ravan-ai/agni-keymon/internal/models"
	"github.com/ravan-ai/agni-keymon/internal/service"
)

func main() {
	_ = godotenv.Load()
	cfg := config.Load()

	if cfg.DatabaseURL == "" || cfg.JWTSecret == "" || cfg.EncryptionKeyHex == "" {
		log.Fatal("DATABASE_URL, JWT_SECRET, and APP_ENCRYPTION_KEY are required")
	}
	if cfg.AdminEmail == "" || cfg.AdminPassword == "" {
		log.Fatal("ADMIN_EMAIL and ADMIN_PASSWORD are required to seed admin")
	}

	if cfg.AppEnv == "production" || os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	ctx := context.Background()
	store, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer store.Close()

	if err := store.Migrate(ctx); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if err := store.EnsureUser(ctx, strings.ToLower(cfg.AdminEmail), cfg.AdminPassword, models.RoleAdmin); err != nil {
		log.Fatalf("seed admin: %v", err)
	}
	if err := store.EnsureUser(ctx, strings.ToLower(cfg.ViewerEmail), cfg.ViewerPassword, models.RoleViewer); err != nil {
		log.Fatalf("seed viewer: %v", err)
	}

	box, err := crypto.New(cfg.EncryptionKeyHex)
	if err != nil {
		log.Fatalf("crypto: %v", err)
	}

	authSvc := auth.New(cfg)
	alertSvc := alerts.New(cfg, store)
	checker := service.NewChecker(cfg, store, box, alertSvc)
	api := handlers.New(cfg, store, authSvc, box, checker)

	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger(), corsMiddleware(cfg.CORSOrigins))

	r.GET("/api/health", api.Health)
	r.POST("/api/auth/login", api.Login)
	r.POST("/api/auth/logout", api.Logout)

	authed := r.Group("/api", authSvc.Middleware(models.RoleAdmin, models.RoleViewer))
	authed.GET("/auth/me", api.Me)
	authed.GET("/dashboard", api.Dashboard)
	authed.GET("/projects", api.ListProjects)
	authed.GET("/projects/:id", api.GetProject)

	admin := r.Group("/api", authSvc.Middleware(models.RoleAdmin))
	admin.POST("/projects", api.CreateProject)
	admin.PUT("/projects/:id", api.UpdateProject)
	admin.DELETE("/projects/:id", api.DeleteProject)
	admin.POST("/projects/:id/members", api.AddMember)
	admin.PUT("/projects/:id/members/:memberId", api.UpdateMember)
	admin.DELETE("/projects/:id/members/:memberId", api.DeleteMember)
	admin.POST("/projects/:id/check", api.CheckProject)
	admin.GET("/keys", api.ListKeys)
	admin.POST("/keys", api.CreateKey)
	admin.PUT("/keys/:id", api.UpdateKey)
	admin.DELETE("/keys/:id", api.DeleteKey)
	admin.POST("/keys/:id/check", api.CheckKey)
	admin.POST("/keys/check-all", api.CheckAll)

	// Background credit checker
	go func() {
		ticker := time.NewTicker(cfg.CheckInterval)
		defer ticker.Stop()
		// initial delay so boot can finish
		time.Sleep(15 * time.Second)
		checker.CheckAll(context.Background())
		for range ticker.C {
			checker.CheckAll(context.Background())
		}
	}()

	srv := &http.Server{Addr: ":" + cfg.ServerPort, Handler: r}
	go func() {
		log.Printf("agni-keymon listening on :%s", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}

func corsMiddleware(origins []string) gin.HandlerFunc {
	allowed := map[string]bool{}
	for _, o := range origins {
		allowed[o] = true
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && allowed[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
