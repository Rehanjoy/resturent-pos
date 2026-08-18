"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api";
import { categoriesApi, menuItemsApi } from "@/lib/menu/api";
import type { Category, MenuItem } from "@/lib/menu/types";
import { CategorySidebar } from "./category-sidebar";
import { DishCard } from "./dish-card";
import { CategoryFormModal } from "./category-form-modal";
import { DishFormModal } from "./dish-form-modal";

const MANAGE_ROLES = new Set(["owner", "manager"]);

function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function MenuScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = !!user && MANAGE_ROLES.has(user.role);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [categoryModal, setCategoryModal] = useState<
    { mode: "add" | "edit"; category: Category | null } | null
  >(null);
  const [dishModal, setDishModal] = useState<
    { mode: "add" | "edit"; item: MenuItem | null } | null
  >(null);
  const [formError, setFormError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const menuItemsQuery = useQuery({
    queryKey: ["menuItems"],
    queryFn: () => menuItemsApi.list(),
  });

  const categories = categoriesQuery.data?.categories ?? [];
  const menuItems = menuItemsQuery.data?.menuItems;

  const visibleItems = useMemo(() => {
    const all = menuItems ?? [];
    return activeCategoryId ? all.filter((item) => item.categoryId === activeCategoryId) : all;
  }, [menuItems, activeCategoryId]);

  const createCategoryMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not add the category.")),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { name?: string; displayOrder?: number };
    }) => categoriesApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not update the category.")),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: categoriesApi.remove,
    onSuccess: (_, categoryId) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      if (activeCategoryId === categoryId) setActiveCategoryId(null);
    },
    onError: (error) => {
      window.alert(errorMessageOf(error, "Could not delete the category."));
    },
  });

  const createItemMutation = useMutation({
    mutationFn: menuItemsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
      setDishModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not add the dish.")),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof menuItemsApi.update>[1] }) =>
      menuItemsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menuItems"] });
      setDishModal(null);
      setFormError(null);
    },
    onError: (error) => setFormError(errorMessageOf(error, "Could not update the dish.")),
  });

  const deleteItemMutation = useMutation({
    mutationFn: menuItemsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menuItems"] }),
    onError: (error) => {
      window.alert(errorMessageOf(error, "Could not delete the dish."));
    },
  });

  const availabilityMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      menuItemsApi.update(id, { isAvailable }),
    onSuccess: (result) => {
      queryClient.setQueryData<{ menuItems: MenuItem[] } | undefined>(
        ["menuItems"],
        (current) => {
          if (!current) return current;
          return {
            menuItems: current.menuItems.map((menuItem) =>
              menuItem.id === result.menuItem.id ? result.menuItem : menuItem,
            ),
          };
        },
      );
    },
    onError: (error) => {
      window.alert(errorMessageOf(error, "Could not update availability."));
    },
  });

  const isLoading = categoriesQuery.isLoading || menuItemsQuery.isLoading;
  const isError = categoriesQuery.isError || menuItemsQuery.isError;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-h1 font-semibold text-text">Menu</h1>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setDishModal({ mode: "add", item: null });
            }}
            disabled={categories.length === 0}
            className="rounded-md bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
            title={categories.length === 0 ? "Add a category first" : undefined}
          >
            + Add Dish
          </button>
        )}
      </div>

      {isLoading && <p className="text-small text-text-muted">Loading menu…</p>}

      {isError && (
        <p className="text-small text-error">
          Could not load the menu — check your connection and try again.
        </p>
      )}

      {!isLoading && !isError && (
        <div className="flex flex-col gap-6 md:flex-row">
          <CategorySidebar
            categories={categories}
            activeCategoryId={activeCategoryId}
            onSelect={setActiveCategoryId}
            canManage={canManage}
            onAddCategory={() => {
              setFormError(null);
              setCategoryModal({ mode: "add", category: null });
            }}
            onEditCategory={(category) => {
              setFormError(null);
              setCategoryModal({ mode: "edit", category });
            }}
            onDeleteCategory={(category) => {
              if (window.confirm(`Delete category "${category.name}"?`)) {
                deleteCategoryMutation.mutate(category.id);
              }
            }}
          />

          <div className="flex-1">
            {categories.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
                <p className="text-body text-text-muted">
                  No categories yet. Add your first category to start building the menu.
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setCategoryModal({ mode: "add", category: null })}
                    className="mt-4 rounded-md bg-accent px-4 py-2 text-button text-white"
                  >
                    Add Category
                  </button>
                )}
              </div>
            )}

            {categories.length > 0 && visibleItems.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
                <p className="text-body text-text-muted">
                  No dishes here yet. Add your first dish to this category.
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={() =>
                      setDishModal({ mode: "add", item: null })
                    }
                    className="mt-4 rounded-md bg-accent px-4 py-2 text-button text-white"
                  >
                    Add Dish
                  </button>
                )}
              </div>
            )}

            {visibleItems.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleItems.map((item) => (
                  <DishCard
                    key={item.id}
                    item={item}
                    canManage={canManage}
                    isTogglingAvailability={
                      availabilityMutation.isPending &&
                      availabilityMutation.variables?.id === item.id
                    }
                    onToggleAvailability={(target, isAvailable) =>
                      availabilityMutation.mutate({ id: target.id, isAvailable })
                    }
                    onEdit={(target) => {
                      setFormError(null);
                      setDishModal({ mode: "edit", item: target });
                    }}
                    onDelete={(target) => {
                      if (window.confirm(`Delete "${target.name}"?`)) {
                        deleteItemMutation.mutate(target.id);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {categoryModal && (
        <CategoryFormModal
          category={categoryModal.category}
          onClose={() => {
            setCategoryModal(null);
            setFormError(null);
          }}
          onSubmit={(input) => {
            if (categoryModal.mode === "add") {
              createCategoryMutation.mutate(input);
            } else if (categoryModal.category) {
              updateCategoryMutation.mutate({ id: categoryModal.category.id, input });
            }
          }}
          isSubmitting={createCategoryMutation.isPending || updateCategoryMutation.isPending}
          errorMessage={formError}
        />
      )}

      {dishModal && (
        <DishFormModal
          item={dishModal.item}
          categories={categories}
          defaultCategoryId={activeCategoryId}
          onClose={() => {
            setDishModal(null);
            setFormError(null);
          }}
          onSubmit={(input) => {
            if (dishModal.mode === "add") {
              createItemMutation.mutate(input);
            } else if (dishModal.item) {
              updateItemMutation.mutate({ id: dishModal.item.id, input });
            }
          }}
          isSubmitting={createItemMutation.isPending || updateItemMutation.isPending}
          errorMessage={formError}
        />
      )}
    </main>
  );
}
