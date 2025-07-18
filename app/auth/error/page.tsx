import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ error: string, error_code: string }>;
}): Promise<Metadata> {
  const params = await searchParams;
  return {
    title: `Error: ${params.error_code}`,
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string, error_code: string, error_description: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Sorry, something went wrong.
              </CardTitle>
            </CardHeader>
            <CardContent>
              {params?.error ? (
                <p className="text-sm text-muted-foreground">
                  Error Message: {params.error}
                  {params.error_code && (
                    <>
                      <br />
                      Error Code: {params.error_code}
                    </>
                  )}
                  {params.error_description && (
                    <>
                      <br />
                      Error Description: {params.error_description}
                    </>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  An unspecified error occurred.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
