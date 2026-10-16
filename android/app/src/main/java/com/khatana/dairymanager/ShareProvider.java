package com.khatana.dairymanager;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Minimal, dependency-free ContentProvider that shares files written to
 * cache/share with other apps (WhatsApp, Drive, Files ...) through a
 * content:// URI. Needed because Android 7+ forbids file:// URIs in
 * ACTION_SEND intents.
 */
public class ShareProvider extends ContentProvider {

    public static final String AUTHORITY = "com.khatana.dairymanager.files";

    @Override
    public boolean onCreate() {
        return true;
    }

    private File fileFor(Uri uri) {
        String name = uri.getLastPathSegment();
        File dir = new File(getContext().getCacheDir(), "share");
        return new File(dir, name);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
                        String[] selectionArgs, String sortOrder) {
        File f = fileFor(uri);
        if (!f.exists()) return null;
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        c.addRow(new Object[]{f.getName(), f.length()});
        return c;
    }

    @Override
    public String getType(Uri uri) {
        String n = uri.getLastPathSegment();
        if (n != null && n.endsWith(".pdf")) return "application/pdf";
        return "application/octet-stream";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }
}
